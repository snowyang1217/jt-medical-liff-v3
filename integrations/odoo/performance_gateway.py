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
    price_fields = performance.fields_get(
        ["x_studio_monetary_1", "x_studio_twd"], ["currency_field"]
    )
    currency_field = price_fields["x_studio_monetary_1"].get("currency_field")
    unit_currency_field = price_fields["x_studio_twd"].get("currency_field")
    if not currency_field or not unit_currency_field:
        raise UserError("尚未確認跟刀金額的幣別欄位。")
    currency = env["res.currency"].search([("name", "=", "TWD")], limit=1)
    if not currency:
        raise UserError("尚未啟用新台幣。")

    department_options = dict(performance.with_context(lang="zh_TW").fields_get(
        ["x_studio_selection_1"], ["selection"]
    )["x_studio_selection_1"]["selection"])

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
    can_view_team = False
    if employee_id == 3 and employee.name == "Amy_test" and employee.x_studio_boolean_1 and company_key == "捷旭":
        staff = env["hr.employee"].with_context(allowed_company_ids=[company_id], lang="zh_TW")
        role_field = "x_studio_selection_2"
        access_field = "x_studio_selection_3"
        region_field = "x_studio_selection_1"
        managed_field = "x_studio_selection_4"
        meta = staff.fields_get([role_field, access_field, region_field, managed_field], ["selection"])
        roles = dict(meta[role_field]["selection"])
        rights = dict(meta[access_field]["selection"])
        regions = dict(meta[region_field]["selection"])
        managed_regions = dict(meta[managed_field]["selection"])
        verified = staff.search([("x_studio_char_2", "=", line_id), ("active", "=", True)], limit=2)
        can_view_team = (
            verified.ids == [employee_id] and roles.get(employee[role_field]) == "主管"
            and rights.get(employee[access_field]) == "管理區域"
            and regions.get(employee[region_field]) == "北部"
            and managed_regions.get(employee[managed_field]) == "北區"
        )

    if can_view_team:
        direct_reports = staff.search([
            ("id", "=", 2), ("name", "=", "Jacky_test"), ("company_id", "=", company_id),
            ("parent_id", "=", employee_id), ("active", "=", True),
        ]).filtered(lambda person: roles.get(person[role_field]) == "業務" and regions.get(person[region_field]) == "北部")
        people = staff.browse(employee_id) | direct_reports
        team_domain = [term for term in month_records if term[0] != "x_studio_many2one_1"]
        team_domain.append(("x_studio_many2one_1", "in", people.ids))
        totals = performance._read_group(team_domain, ["x_studio_many2one_1"], ["x_studio_monetary_1:sum"])
        amounts = {person.id: round(amount or 0, 2) for person, amount in totals}
        result = {
            "ok": True,
            "records": [],
            "nextCursor": None,
            "totalAmount": round(sum(amounts.values()), 2),
            "overview": {
                "scope": "region", "scopeLabel": "北部", "pilot": True,
                "salespeople": [{"name": person.name, "amount": amounts.get(person.id, 0)} for person in people],
            },
        }
    else:
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
                "department": department_options.get(row.x_studio_selection_1, ""),
                "doctor": row.x_studio_char_1 or "",
                "unitPrice": row.x_studio_twd if row.x_studio_twd and row[unit_currency_field] == currency else None,
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
    unit_price = payload.get("unitPrice")
    department = payload.get("department", "")
    doctor = payload.get("doctor", "")
    note = payload.get("note", "")
    request_id = payload.get("requestId")
    if not service_date or not valid_id(hospital_id) or not valid_id(product_id):
        raise UserError("請確認跟刀日期、客戶及產品。")
    if not is_number(quantity) or not 0 < quantity < float("inf"):
        raise UserError("數量須大於零。")
    if not is_number(amount) or not 0 <= amount < float("inf") or amount != round(amount, 2):
        raise UserError("請輸入最多兩位小數的新台幣金額。")
    if unit_price is not None and (
        not is_number(unit_price) or not 0 <= unit_price < float("inf") or unit_price != round(unit_price, 2)
    ):
        raise UserError("請輸入最多兩位小數的新台幣單價。")
    if not isinstance(department, str):
        raise UserError("請選擇有效的科別。")
    department_keys = [key for key, label in department_options.items() if label == department]
    if department and len(department_keys) != 1:
        raise UserError("請選擇有效的科別。")
    if not isinstance(doctor, str) or len(doctor.strip()) > 100:
        raise UserError("醫師姓名最多 100 字。")
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

        values = {
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
        }
        if department:
            values["x_studio_selection_1"] = department_keys[0]
        if doctor.strip():
            values["x_studio_char_1"] = doctor.strip()
        if unit_price is not None:
            values["x_studio_twd"] = unit_price
            values[unit_currency_field] = currency.id
        row = performance.create(values)
        marker["res_id"] = row.id
        marker["noupdate"] = True
        identifiers.create(marker)
    result = {"ok": True, "recordId": row.id}

action = {"type": "ir.actions.client", "tag": "jt_line_performance_result", "params": result}
