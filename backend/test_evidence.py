import sys
import json
from pprint import pprint

try:
    from app.ai.ner import SmartDiaryExtractor
    from app.ai.query_parser import parse_query
    from datetime import date
    
    print("--- TEST SET A: PRONOUNS ---")
    ex = SmartDiaryExtractor()
    tests_a = [
        "Ali gave me 5000",
        "I gave Ali 5000",
        "Ali sent me money",
        "I received money from Ali"
    ]
    for t in tests_a:
        res = ex.extract(t, intent="store")
        print(f"Input: {t!r} -> Direction: {res.direction}, Amount: {res.amount}, Person: {res.person}")
        
    print("\n--- TEST SET B: PARAPHRASES ---")
    tests_b = [
        "How much did I give Ali?",
        "Payments to Ali",
        "Money sent to Ali",
        "Total given to Ali"
    ]
    for t in tests_b:
        plan = parse_query(t)
        print(f"Input: {t!r} -> Type: {plan.query_type}, Person: {plan.person}, Direction: {plan.direction}")

    print("\n--- TEST SET C: BROKEN GRAMMAR ---")
    tests_c = [
        "Ali money gave me 5000",
        "5000 Ali me gave"
    ]
    for t in tests_c:
        res = ex.extract(t, intent="store")
        print(f"Input: {t!r} -> Direction: {res.direction}, Amount: {res.amount}, Person: {res.person}")

    print("\n--- TEST SET D: LOCATION QUERY ---")
    tests_d = [
        "Where is my passport?",
        "Passport location?",
        "Where did I keep passport?"
    ]
    for t in tests_d:
        plan = parse_query(t)
        print(f"Input: {t!r} -> Type: {plan.query_type}, Item: {plan.item}")

    print("\n--- TEST SET E: ZAKAT ---")
    # Mocking the Zakat calculation manually to show logic since DB is not seeded
    gold = 1000000 # 10g
    cash = 100000
    total = gold + cash
    nisab = 200000
    due = total * 0.025 if total > nisab else 0
    print(f"Total: {total}, Nisab: {nisab}, Due: {due}")
    
except Exception as e:
    import traceback
    traceback.print_exc()

