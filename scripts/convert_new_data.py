import json

with open('Gas_historyTalking_v2.1.json', 'r', encoding='utf-8') as f:
    new_data = json.load(f)

categories = []
questions = []
options = []
response_types = [
    {"type_id": "RT001", "type_code": "YES_NO",        "is_multiple": False},
    {"type_id": "RT002", "type_code": "MULTI_SELECT",  "is_multiple": True},
    {"type_id": "RT003", "type_code": "SINGLE_SELECT", "is_multiple": False},
]
flow_logic = []

cat_keys = list(new_data.keys())

for cat_idx, cat_key in enumerate(cat_keys):
    cat_data = new_data[cat_key]
    cat_id   = f"CAT{str(cat_idx+1).zfill(3)}"

    categories.append({
        "category_id":      cat_id,
        "category_code":    cat_key.upper(),
        "category_name_ko": cat_data["title"],
        "category_name_vi": cat_data["title"],
        "category_name_id": cat_data["title"],
        "display_order":    cat_idx + 1,
        "is_active":        True
    })

    red_flags        = cat_data.get("redFlags", [])
    regular_qs       = cat_data.get("questions", [])
    reg_question_ids = []

    # ── Red Flag 질문 ──────────────────────────────────────────
    for rf_idx, rf_text in enumerate(red_flags):
        q_id       = f"{cat_id}_RF{str(rf_idx+1).zfill(2)}"
        yes_opt_id = f"{q_id}_YES"
        no_opt_id  = f"{q_id}_NO"

        questions.append({
            "question_id":      q_id,
            "question_index":   f"{cat_id}RF{str(rf_idx+1).zfill(2)}",
            "category_id":      cat_id,
            "question_type":    f"Red Flag{rf_idx+1}",
            "question_text_ko": rf_text,
            "question_text_vi": rf_text,
            "question_text_id": rf_text,
            "response_type_id": "RT001",
            "is_red_flag":      True,
            "display_order":    rf_idx + 1,
            "is_active":        True
        })

        options.append({
            "option_id":      yes_opt_id,
            "option_index":   f"{q_id}001",
            "question_id":    q_id,
            "option_text_ko": "예",
            "option_text_vi": "Có",
            "option_text_id": "Ya",
            "display_order":  1,
            "is_exclusive":   True,
            "next_question_id": ""
        })
        options.append({
            "option_id":      no_opt_id,
            "option_index":   f"{q_id}002",
            "question_id":    q_id,
            "option_text_ko": "아니오",
            "option_text_vi": "Không",
            "option_text_id": "Tidak",
            "display_order":  2,
            "is_exclusive":   True,
            "next_question_id": ""
        })

        # YES → ALERT_RED_FLAG (priority 1)
        flow_logic.append({
            "flow_id":             f"FL_{q_id}_YES",
            "from_question_id":    q_id,
            "condition_option_id": yes_opt_id,
            "condition_value":     "YES",
            "to_question_id":      "ALERT_RED_FLAG",
            "priority":            1
        })

    # ── 일반 질문 ──────────────────────────────────────────────
    for q_idx, q_data in enumerate(regular_qs):
        q_id        = f"{cat_id}_Q{str(q_idx+1).zfill(2)}"
        resp_type   = "RT002" if q_data["type"] == "checkbox" else "RT003"
        reg_question_ids.append(q_id)

        questions.append({
            "question_id":      q_id,
            "question_index":   f"{cat_id}Q{str(q_idx+1).zfill(2)}",
            "category_id":      cat_id,
            "question_type":    f"일반문진{q_idx+1}",
            "question_text_ko": q_data["text"],
            "question_text_vi": q_data["text"],
            "question_text_id": q_data["text"],
            "response_type_id": resp_type,
            "is_red_flag":      False,
            "display_order":    len(red_flags) + q_idx + 1,
            "is_active":        True
        })

        for opt_idx, opt_text in enumerate(q_data.get("options", [])):
            opt_id = f"{q_id}_O{str(opt_idx+1).zfill(2)}"
            is_excl = any(kw in opt_text for kw in [
                "모르겠다", "해당없음", "해당 없음", "잘 모르겠음",
                "없음", "없었음", "없다"
            ])
            options.append({
                "option_id":      opt_id,
                "option_index":   f"{q_id}O{str(opt_idx+1).zfill(2)}",
                "question_id":    q_id,
                "option_text_ko": opt_text,
                "option_text_vi": opt_text,
                "option_text_id": opt_text,
                "display_order":  opt_idx + 1,
                "is_exclusive":   is_excl,
                "next_question_id": ""
            })

    # ── FlowLogic: Red Flag NO → 다음 질문 ─────────────────────
    for rf_idx in range(len(red_flags)):
        q_id      = f"{cat_id}_RF{str(rf_idx+1).zfill(2)}"
        no_opt_id = f"{q_id}_NO"

        if rf_idx + 1 < len(red_flags):
            next_q = f"{cat_id}_RF{str(rf_idx+2).zfill(2)}"
        elif reg_question_ids:
            next_q = reg_question_ids[0]
        else:
            next_q = "END"

        flow_logic.append({
            "flow_id":             f"FL_{q_id}_NO",
            "from_question_id":    q_id,
            "condition_option_id": no_opt_id,
            "condition_value":     "NO",
            "to_question_id":      next_q,
            "priority":            2
        })

    # ── FlowLogic: 일반 질문 ALWAYS → 다음 질문 ───────────────
    for q_idx, q_id in enumerate(reg_question_ids):
        next_q = reg_question_ids[q_idx + 1] if q_idx + 1 < len(reg_question_ids) else "END"
        flow_logic.append({
            "flow_id":             f"FL_{q_id}_ALWAYS",
            "from_question_id":    q_id,
            "condition_option_id": "",
            "condition_value":     "ALWAYS",
            "to_question_id":      next_q,
            "priority":            1
        })

result = {
    "Category":     categories,
    "Question":     questions,
    "Option":       options,
    "ResponseType": response_types,
    "FlowLogic":    flow_logic,
    "StringTable":  []
}

out_path = 'frontend/src/data/questionnaireData.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"✅ 변환 완료: {out_path}")
print(f"   카테고리:  {len(categories)}개")
print(f"   질문:      {len(questions)}개")
print(f"   선택지:    {len(options)}개")
print(f"   FlowLogic: {len(flow_logic)}개")
for cat in categories:
    print(f"   └ {cat['category_id']} {cat['category_name_ko']}")
