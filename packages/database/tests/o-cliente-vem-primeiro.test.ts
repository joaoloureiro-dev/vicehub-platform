ls packages/database/tests/ && cat packages/database/vitest.config.ts 2>/dev/null | head -20; python3 -c "
import json
d=json.load(open('packages/database/package.json'))
print('test script:', d['scripts'].get('test','(nenhum)'))"
