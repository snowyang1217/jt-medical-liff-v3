# Unbound Studio server action for x_1216. The Make integration calls it through ir.actions.server/run.
context = env.context
operation = context.get("line_performance_operation")
payload = context.get("line_performance_data")
employee_id = context.get("line_employee_id")
company_id = context.get("line_company_id")
company_key = context.get("line_performance_company")
line_id = context.get("line_verified_user_id")


def valid_id(value):
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def date_value(value):
    if not isinstance(value, str) or len(value) != 10:
        return None
    try:
        parsed = datetime.date.fromisoformat(value)
    except Exception:
        return None
    return parsed if parsed.isoformat() == value else None


if not env.user.has_group("base.group_system"):
    raise UserError("請使用已授權的 Odoo 整合帳號。")
if not valid_id(employee_id) or not valid_id(company_id) or not isinstance(line_id, str) or not line_id:
    raise UserError("無法核對業務身分。")
if company_id not in env.user.company_ids.ids:
    raise UserError("整合帳號無法存取這間公司。")
if not isinstance(payload, dict) or operation not in ("SEARCH_REFERENCES", "CREATE_RECORD", "LIST_OWN_RECORDS"):
    raise UserError("不支援這項跟刀業績操作。")

employee = env["hr.employee"].browse(employee_id).exists()
if not employee or not employee.active or employee.company_id.id != company_id or employee.x_studio_char_2 != line_id:
    raise UserError("無法核對業務身分。")

performance = env["x_1216"].with_context(allowed_company_ids=[company_id])
company_options = dict(performance.fields_get(["x_studio_"], ["selection"])["x_studio_"]["selection"])
if not isinstance(company_key, str) or company_key not in company_options:
    raise UserError("跟刀業績的公司對照尚未設定。")

related_company = ["|", ("company_id", "=", False), ("company_id", "=", company_id)]
customers = env["res.partner"].with_context(allowed_company_ids=[company_id])
products = env["product.product"].with_context(allowed_company_ids=[company_id])
own_records = [("x_studio_", "=", company_key), ("x_studio_many2one_1", "=", employee_id)]

if operation in ("CREATE_RECORD", "LIST_OWN_RECORDS"):
    currency_field = performance.fields_get(
        ["x_studio_monetary_1"], ["currency_field"]
    )["x_studio_monetary_1"].get("currency_field")
    if not currency_field:
        raise UserError("尚未確認跟刀金額的幣別欄位。")
    currency = env["res.currency"].search([("name", "=", "TWD")], limit=1)
    if not currency:
        raise UserError("尚未啟用新台幣。")

if operation == "SEARCH_REFERENCES":
    field = payload.get("field")
    keyword = payload.get("keyword")
    if not isinstance(keyword, str):
        raise UserError("請輸入有效的搜尋關鍵字。")
    keyword = keyword.strip()
    if not keyword or len(keyword) > 80 or not keyword.replace("%", "").replace("_", "").strip():
        raise UserError("請輸入有效的搜尋關鍵字。")
    if field == "hospitalId":
        options = customers.search(related_company + [("name", "ilike", keyword)], limit=20, order="name, id")
    elif field == "productId":
        options = products.search(
            related_company + ["|", ("name", "ilike", keyword), ("default_code", "ilike", keyword)],
            limit=20, order="name, id",
        )
    else:
        raise UserError("不支援這項搜尋。")
    result = {"ok": True, "options": [{"id": row.id, "label": row.display_name} for row in options]}

elif operation == "LIST_OWN_RECORDS":
    month = payload.get("month")
    month_start = date_value(month + "-01") if isinstance(month, str) else None
    cursor = payload.get("cursor")
    if not month_start or (month_start.year == 9999 and month_start.month == 12):
        raise UserError("請選擇正確的查詢月份。")
    if cursor is not None and (
        not isinstance(cursor, str) or not 1 <= len(cursor) <= 10
        or not cursor.isascii() or not cursor.isdecimal() or not 1 <= int(cursor) <= 2147483647
    ):
        raise UserError("分頁位置無效，請重新查詢。")

    next_month = month_start + dateutil.relativedelta.relativedelta(months=1)
    month_records = own_records + [
        (currency_field, "=", currency.id),
        ("x_studio_date_1", ">=", month_start.isoformat()),
        ("x_studio_date_1", "<", next_month.isoformat()),
    ]
    page_records = month_records + ([("id", "<", int(cursor))] if cursor is not None else [])
    page = performance.search(page_records, limit=51, order="id desc")
    rows = page[:50]
    result = {
        "ok": True,
        "records": [{
            "id": row.id,
            "label": row.x_studio_many2one_3.display_name or row.x_name,
            "date": row.x_studio_date_1.isoformat(),
            "hospital": row.x_studio_many2one_2.display_name or "",
            "quantity": row.x_studio_float_1,
            "amount": row.x_studio_monetary_1,
        } for row in rows],
        "nextCursor": str(rows[-1].id) if len(page) > 50 else None,
    }
    if cursor is None:
        totals = performance._read_group(month_records, [], ["x_studio_monetary_1:sum"])
        result["totalAmount"] = round(totals[0][0] or 0, 2) if totals else 0

else:
    service_date = date_value(payload.get("serviceDate"))
    hospital_id = payload.get("hospitalId")
    product_id = payload.get("productId")
    quantity = payload.get("quantity")
    amount = payload.get("amount")
    note = payload.get("note", "")
    request_id = payload.get("requestId")
    if not service_date or not valid_id(hospital_id) or not valid_id(product_id):
        raise UserError("請確認跟刀日期、客戶及產品。")
    if not is_number(quantity) or not 0 < quantity < float("inf"):
        raise UserError("數量須大於零。")
    if not is_number(amount) or not 0 <= amount < float("inf") or amount != round(amount, 2):
        raise UserError("請輸入最多兩位小數的新台幣金額。")
    if not isinstance(note, str) or len(note) > 1000:
        raise UserError("備註最多 1,000 字。")
    if not isinstance(request_id, str) or len(request_id) != 36 or [len(part) for part in request_id.split("-")] != [8, 4, 4, 4, 12]:
        raise UserError("填報識別碼無效。")
    request_key = request_id.lower().replace("-", "")
    if any(char not in "0123456789abcdef" for char in request_key):
        raise UserError("填報識別碼無效。")

    identifiers = env["ir.model.data"]
    marker = {
        "module": "jt_line_performance",
        "name": "company_%s_employee_%s_request_%s" % (company_id, employee_id, request_key),
        "model": "x_1216",
    }
    existing = identifiers.search([("module", "=", marker["module"]), ("name", "=", marker["name"])], limit=1)
    if existing:
        row = performance.search(own_records + [("id", "=", existing.res_id)], limit=1) if existing.model == marker["model"] else performance.browse([])
        if not row:
            raise UserError("原填報紀錄已不在可存取範圍，請聯絡管理者。")
    else:
        hospital = customers.search(related_company + [("id", "=", hospital_id)], limit=1)
        product = products.search(related_company + [("id", "=", product_id)], limit=1)
        if not hospital or not product:
            raise UserError("客戶或產品已不在可用範圍，請重新搜尋。")

        row = performance.create({
            "x_name": "%s｜%s｜%s" % (employee.name, product.display_name, service_date.isoformat()),
            "x_studio_": company_key,
            "x_studio_many2one_1": employee_id,
            "x_studio_date_1": service_date.isoformat(),
            "x_studio_many2one_2": hospital.id,
            "x_studio_many2one_3": product.id,
            "x_studio_float_1": quantity,
            "x_studio_monetary_1": amount,
            "x_studio_text_1": note.strip(),
            currency_field: currency.id,
        })
        marker["res_id"] = row.id
        marker["noupdate"] = True
        identifiers.create(marker)
    result = {"ok": True, "recordId": row.id}

action = {"type": "ir.actions.client", "tag": "jt_line_performance_result", "params": result}
