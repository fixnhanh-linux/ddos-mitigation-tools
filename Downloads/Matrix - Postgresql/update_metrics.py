import json
import re

file_path = "c:\\Users\\FIX NHANH\\Downloads\\Matrix - Postgresql\\Matrix - Postgresql-1785397606850.json"
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

labels_to_add = 'environment="production", instance="postgresql://localhost:5432/postgres", job="postgres-prod"'

def process_expr(expr):
    def repl(match):
        metric = match.group(1)
        labels = match.group(2)
        if labels:
            if labels_to_add in labels:
                return match.group(0) # already there
            return f"{metric}{{{labels_to_add}, {labels[1:]}"
        else:
            return f"{metric}{{{labels_to_add}}}"

    expr = re.sub(r'(pg_[a-zA-Z0-9_]+)(\{[^}]*\})?', repl, expr)
    return expr

def traverse(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "expr" and isinstance(v, str):
                obj[k] = process_expr(v)
            else:
                traverse(v)
    elif isinstance(obj, list):
        for item in obj:
            traverse(item)

traverse(data)

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print("Done")
