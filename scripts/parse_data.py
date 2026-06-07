import os
import json
import pandas as pd
import numpy as np

def clean_value(val):
    if pd.isna(val) or val == "" or val is None:
        return None
    if isinstance(val, (int, float)):
        # Handle nan/inf
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    # Convert string numbers
    val_str = str(val).strip().replace(",", "")
    try:
        return float(val_str)
    except ValueError:
        return val_str

def parse_excel():
    excel_path = "자산관리_260530.xlsx"
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel file not found at {excel_path}")
        
    xl = pd.ExcelFile(excel_path)
    data = {}
    
    # 1. Parse '자산' sheet (Current Assets)
    df_assets = xl.parse("자산")
    # Columns: Unnamed: 0 (Type), Unnamed: 1 (Name), Unnamed: 2 (Amount), Unnamed: 4 (Cat Name), Unnamed: 5 (Cat Sum)
    assets_list = []
    category_summary = []
    
    # Forward fill Type to group assets
    df_assets['Unnamed: 0'] = df_assets['Unnamed: 0'].ffill()
    
    for idx, row in df_assets.iterrows():
        # Parse individual assets
        asset_type = row.get('Unnamed: 0')
        asset_name = row.get('Unnamed: 1')
        asset_val = row.get('Unnamed: 2')
        
        if pd.notna(asset_name) and pd.notna(asset_val):
            assets_list.append({
                "type": str(asset_type).strip(),
                "name": str(asset_name).strip(),
                "value": clean_value(asset_val)
            })
            
        # Parse category summary
        cat_name = row.get('Unnamed: 4')
        cat_val = row.get('Unnamed: 5')
        if pd.notna(cat_name) and pd.notna(cat_val):
            category_summary.append({
                "category": str(cat_name).strip(),
                "value": clean_value(cat_val)
            })
            
    data["current_assets"] = {
        "items": assets_list,
        "summary": category_summary
    }
    
    # 2. Parse '일별' sheet (Historical trend)
    df_daily = xl.parse("일별")
    daily_list = []
    for idx, row in df_daily.iterrows():
        date_val = row.get("날짜")
        if pd.notna(date_val):
            # Parse date
            try:
                date_str = pd.to_datetime(date_val).strftime("%Y-%m-%d")
            except:
                date_str = str(date_val).split("T")[0]
                
            daily_list.append({
                "date": date_str,
                "real_estate": clean_value(row.get("부동산")),
                "savings": clean_value(row.get("예적금")),
                "insurance_pension": clean_value(row.get("보험/연금")),
                "investment": clean_value(row.get("투자")),
                "hui": clean_value(row.get("휴이")),
                "net_assets": clean_value(row.get("순자산")),
                "yoy_diff": clean_value(row.get("1년전대비"))
            })
    # Sort chronologically
    daily_list = sorted(daily_list, key=lambda x: x["date"])
    data["historical_trend"] = daily_list
    
    # 3. Parse '연금목표' sheet (Pension and Investment projections side by side)
    df_pension_target = xl.parse("연금목표")
    pension_proj = []
    inv_proj = []
    
    # Starting from row 3 (idx 3) where columns Unnamed: 1 is Age
    for idx, row in df_pension_target.iloc[3:].iterrows():
        age_p = row.get("Unnamed: 1")
        year_p = row.get("Unnamed: 2")
        if pd.notna(age_p) and pd.notna(year_p):
            try:
                age_int = int(float(age_p))
                pension_proj.append({
                    "age": age_int,
                    "year": int(float(year_p)),
                    "actual": clean_value(row.get("Unnamed: 3")),
                    "expected_6pct": clean_value(row.get("Unnamed: 4")),
                    "expected_8pct": clean_value(row.get("Unnamed: 5")),
                    "expected_10pct": clean_value(row.get("Unnamed: 6")),
                    "yoy_return": clean_value(row.get("Unnamed: 7"))
                })
            except ValueError:
                pass
                
        age_i = row.get("Unnamed: 9")
        year_i = row.get("Unnamed: 10")
        if pd.notna(age_i) and pd.notna(year_i):
            try:
                age_int = int(float(age_i))
                inv_proj.append({
                    "age": age_int,
                    "year": int(float(year_i)),
                    "actual": clean_value(row.get("Unnamed: 11")),
                    "expected_6pct": clean_value(row.get("Unnamed: 12")),
                    "expected_8pct": clean_value(row.get("Unnamed: 13")),
                    "expected_10pct": clean_value(row.get("Unnamed: 14")),
                    "yoy_return": clean_value(row.get("Unnamed: 15"))
                })
            except ValueError:
                pass
                
    data["pension_projection"] = pension_proj
    data["investment_projection"] = inv_proj
    
    # 4. Parse '휴이목표' sheet
    df_hui_target = xl.parse("휴이목표")
    hui_proj = []
    for idx, row in df_hui_target.iloc[2:].iterrows():
        age_h = row.get("Unnamed: 0")
        year_h = row.get("Unnamed: 1")
        if pd.notna(age_h) and pd.notna(year_h):
            try:
                age_int = int(float(age_h))
                hui_proj.append({
                    "age": age_int,
                    "year": int(float(year_h)),
                    "actual": clean_value(row.get("Unnamed: 2")),
                    "expected_6pct": clean_value(row.get("예상")),
                    "expected_8pct": clean_value(row.get("Unnamed: 4")),
                    "expected_10pct": clean_value(row.get("Unnamed: 5")),
                    "yoy_return": clean_value(row.get("Unnamed: 6"))
                })
            except ValueError:
                pass
    data["hui_projection"] = hui_proj
    
    # 5. Parse '연금' sheet (Pension Strategies)
    df_pension_strategy = xl.parse("연금")
    strategies = []
    for idx, row in df_pension_strategy.iterrows():
        p_name = row.get("Unnamed: 1")
        if pd.notna(p_name) and str(p_name).strip() in ["연금저축", "IRP", "ISA"]:
            strategies.append({
                "name": str(p_name).strip(),
                "deduction": clean_value(row.get("공제")),
                "annual_limit": clean_value(row.get("납입\n한도\n/년")),
                "tax_free_dividend": clean_value(row.get("배당\n면세")),
                "withdrawal_age": clean_value(row.get("출금")),
                "safe_asset_ratio": clean_value(row.get("안전\n자산\n비율")),
                "annual_payment": clean_value(row.get("납입\n/년")),
                "monthly_payment": clean_value(row.get("납입\n/월")),
                "strategy_bodol": clean_value(row.get("운용전략(보돌)")),
                "strategy_ppaekdol": clean_value(row.get("운용전략(빽돌)"))
            })
    data["pension_strategies"] = strategies
    
    # 6. Parse '영석연봉' sheet
    df_salary = xl.parse("영석연봉")
    salary_list = []
    for idx, row in df_salary.iterrows():
        year_s = row.get("년도")
        salary_val = row.get("당해연봉")
        if pd.notna(year_s) and pd.notna(salary_val):
            try:
                salary_list.append({
                    "year": int(float(year_s)),
                    "salary": clean_value(salary_val),
                    "growth_rate": clean_value(row.get("총연봉 상승률")),
                    "withholding_tax": clean_value(row.get("원천징수")),
                    "tax": clean_value(row.get("세금")),
                    "effective_tax_rate": clean_value(row.get("실효세율")),
                    "note": clean_value(row.get("비고"))
                })
            except ValueError:
                pass
    data["salary_history"] = salary_list
    
    # 7. Parse '미래' sheet (Long-term cash flow & asset projection)
    df_future = xl.parse("미래")
    future_proj = []
    
    # We find where rows start by checking row 1 headers
    # Row 1 indices:
    # Unnamed: 5 = 이벤트, Unnamed: 6 = 급여(세후), Unnamed: 8 = 생활비, Unnamed: 27 = 자산, etc.
    # The actual data rows start at row 2 (idx 2)
    # The year is in the '전세' column (which from idx 2 onwards has values like 2025, 2026, 2027)
    
    for idx, row in df_future.iloc[2:].iterrows():
        year_f = row.get("전세")
        if pd.notna(year_f):
            try:
                year_int = int(float(year_f))
                
                # Fetch asset values
                future_proj.append({
                    "year": year_int,
                    "event": clean_value(row.get("Unnamed: 5")),
                    "net_salary": clean_value(row.get("Unnamed: 6")),
                    "additional_income": clean_value(row.get("Unnamed: 7")),
                    "living_expenses": clean_value(row.get("Unnamed: 8")),
                    "surplus": clean_value(row.get("Unnamed: 9")),
                    "contrib_pension_savings": clean_value(row.get("Unnamed: 10")),
                    "contrib_irp": clean_value(row.get("Unnamed: 11")),
                    "contrib_isa": clean_value(row.get("Unnamed: 12")),
                    "contrib_us_stock": clean_value(row.get("Unnamed: 13")),
                    "contrib_coin": clean_value(row.get("Unnamed: 14")),
                    "housing_expense": clean_value(row.get("Unnamed: 15")),
                    "contrib_savings": clean_value(row.get("Unnamed: 16")),
                    "contrib_company_pension": clean_value(row.get("Unnamed: 17")),
                    "jeonse_deposit": clean_value(row.get("Unnamed: 18")),
                    "buy_home": clean_value(row.get("Unnamed: 19")),
                    # Balances
                    "bal_savings": clean_value(row.get("Unnamed: 20")),
                    "bal_pension_savings": clean_value(row.get("Unnamed: 21")),
                    "bal_company_pension": clean_value(row.get("Unnamed: 22")),
                    "bal_irp": clean_value(row.get("Unnamed: 23")),
                    "bal_isa": clean_value(row.get("Unnamed: 24")),
                    "bal_us_stock": clean_value(row.get("Unnamed: 25")),
                    "bal_coin": clean_value(row.get("Unnamed: 26")),
                    "total_assets": clean_value(row.get("Unnamed: 27")),
                    "assets_delta": clean_value(row.get("Unnamed: 28"))
                })
            except ValueError:
                pass
                
    data["future_cash_flow_projection"] = future_proj

    # Save to data/data.json
    os.makedirs("data", exist_ok=True)
    with open("data/data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"Data parsed successfully. Saved to 'data/data.json'.")

if __name__ == "__main__":
    parse_excel()
