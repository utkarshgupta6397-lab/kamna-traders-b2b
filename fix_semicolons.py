import re

with open('final_script.sql') as f:
    sql = f.read()

# Fix the trailing semicolons inside CREATE TABLE
sql = sql.replace('CASCADE;,', 'CASCADE,')
sql = sql.replace('CASCADE;\n);', 'CASCADE\n);')

# Also fix RESTRICT
sql = sql.replace('RESTRICT;,', 'RESTRICT,')
sql = sql.replace('RESTRICT;\n);', 'RESTRICT\n);')

with open('final_script_fixed.sql', 'w') as f:
    f.write(sql)
