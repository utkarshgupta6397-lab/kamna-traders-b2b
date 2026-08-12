import re

with open('full_diff.sql') as f:
    sql = f.read()

# Make CREATE TABLE and CREATE INDEX idempotent
sql = sql.replace('CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "')
sql = sql.replace('CREATE INDEX "', 'CREATE INDEX IF NOT EXISTS "')
sql = sql.replace('CREATE UNIQUE INDEX "', 'CREATE UNIQUE INDEX IF NOT EXISTS "')

# Move constraints into CREATE TABLE for new tables
create_table_pattern = re.compile(r'CREATE TABLE IF NOT EXISTS "([^"]+)" \((.*?)\n\);', re.DOTALL)
alter_fk_pattern = re.compile(r'-- AddForeignKey\nALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \(([^)]+)\) REFERENCES "([^"]+)"\([^)]+\) ON DELETE [^;]+;')

tables = {}
for match in create_table_pattern.finditer(sql):
    table_name = match.group(1)
    body = match.group(2)
    tables[table_name] = body

fks_by_table = {}
remaining_alters = []

for match in alter_fk_pattern.finditer(sql):
    table = match.group(1)
    fk_stmt = match.group(0).split('\n')[1].replace(f'ALTER TABLE "{table}" ADD ', '')
    if table in tables:
        if table not in fks_by_table:
            fks_by_table[table] = []
        fks_by_table[table].append(fk_stmt)
    else:
        remaining_alters.append(match.group(0))

new_sql = sql
for table, fks in fks_by_table.items():
    old_create = f'CREATE TABLE IF NOT EXISTS "{table}" (' + tables[table] + '\n);'
    new_body = tables[table]
    for fk in fks:
        new_body += ',\n    ' + fk
    new_create = f'CREATE TABLE IF NOT EXISTS "{table}" (' + new_body + '\n);'
    new_sql = new_sql.replace(old_create, new_create)

for table in fks_by_table:
    # Remove the old ALTER TABLE statements
    pattern = re.compile(r'-- AddForeignKey\nALTER TABLE "' + table + r'" ADD CONSTRAINT [^;]+;\n*')
    new_sql = pattern.sub('', new_sql)

# Ensure no `cuid()` default for ids
# Prisma outputs DEFAULT CURRENT_TIMESTAMP etc, but we don't want CUID inside sql because postgres has no cuid()
# Let's verify what prisma outputted for IDs: "id" TEXT NOT NULL, ... Prisma doesn't output default cuid() in diffs! 
# So that's perfectly safe.
    
with open('final_script.sql', 'w') as f:
    f.write(new_sql)
