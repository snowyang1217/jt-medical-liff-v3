# Odoo Studio server action on x_1213. Make supplies validated employee context.
context = env.context
employee_id = context.get("line_employee_id")
company_id = context.get("line_company_id")
company_key = context.get("line_transfer_company")
decision = context.get("line_transfer_decision")
reason = context.get("line_transfer_reason", "")

if context.get("active_model") != "x_1213" or len(records) != 1:
    raise UserError("請選擇一筆機台交接紀錄。")
if (
    not isinstance(employee_id, int) or isinstance(employee_id, bool) or employee_id < 1
    or not isinstance(company_id, int) or isinstance(company_id, bool) or company_id < 1
    or not isinstance(company_key, str) or not company_key
):
    raise UserError("無法核對接收人身分。")
if decision not in ("accept", "reject"):
    raise UserError("無效的交接操作。")
if decision == "reject":
    if not isinstance(reason, str) or not reason.strip() or len(reason.strip()) > 1000:
        raise UserError("請填寫拒絕原因，最多 1,000 字。")
    reason = reason.strip()

transfer = records.exists()
if not transfer:
    raise UserError("找不到交接紀錄。")
transfer.check_access("write")
transfer = transfer.try_lock_for_update()
if not transfer:
    raise UserError("這筆交接正在處理中，請更新紀錄後再試。")
transfer.invalidate_recordset()

receiver = transfer.x_studio_many2one_3
if (
    receiver.id != employee_id or not receiver.active
    or receiver.company_id.id != company_id
    or transfer.x_studio_selection_1 != company_key
):
    raise UserError("只有這筆交接的接收人可處理。")

target_status = "已確認" if decision == "accept" else "已拒絕"
if transfer.x_studio_selection_2 != target_status:
    if transfer.x_studio_selection_2 != "待確認":
        raise UserError("這筆交接已處理，請更新交接紀錄。")

    if decision == "accept":
        machine = transfer.x_studio_many2one_1.exists()
        if not machine:
            raise UserError("找不到交接機台。")
        machine.check_access("write")
        machine = machine.try_lock_for_update()
        if not machine:
            raise UserError("這部機台正在處理中，請更新紀錄後再試。")
        machine.invalidate_recordset()

        sender = transfer.x_studio_many2one_2
        if (
            not sender or machine.x_studio_selection_1 != company_key
            or machine.x_studio_many2one_2.id != sender.id
        ):
            raise UserError("機台保管人或所屬公司已變更，請更新紀錄。")

        machine.write({"x_studio_many2one_2": receiver.id})
        transfer.write({
            "x_studio_many2one_4": receiver.id,
            "x_studio_selection_2": target_status,
            "x_studio_datetime_3": datetime.datetime.utcnow(),
        })
    else:
        transfer.write({
            "x_studio_selection_2": target_status,
            "x_studio_text_1": reason,
        })
