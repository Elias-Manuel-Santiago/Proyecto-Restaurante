"""Genera SVG y draw.io desde las columnas reales del SQL, sin dependencias."""
import json
import re
from pathlib import Path
from html import escape
import xml.etree.ElementTree as ET

BASE = Path(__file__).resolve().parent
sql = (BASE / 'restaurante.sql').read_text(encoding='utf-8')
positions = {
    'mesas': (40, 110), 'pedidos': (440, 110),
    'pedidos_comida': (840, 110), 'comidas': (1240, 110),
    'usuarios': (40, 670), 'sesiones_usuarios': (440, 670),
    'resumenes': (840, 670), 'resumen_comida': (1240, 670),
    'Unidades': (40, 1150), 'Stock': (440, 1150), 'comida_stock': (840, 1150), 'envios': (1240, 1150),
}
tables = {}
for name, body in re.findall(r'CREATE TABLE (\w+) \((.*?)\n\) ENGINE', sql, re.S):
    pk = re.search(r'PRIMARY KEY \(([^)]+)\)', body).group(1).split(',')
    fk = re.findall(r'FOREIGN KEY \((\w+)\)', body)
    rows = []
    for line in body.splitlines():
        match = re.match(r'  (\w+) ((?:INT|VARCHAR\(\d+\)|CHAR\(\d+\)|TINYINT\(1\)|DATETIME\(3\)|DECIMAL\(\d+,\d+\)|TEXT|LONGTEXT))\s+(.*)', line)
        if not match:
            continue
        col, typ, tail = match.groups()
        key = ('PK' if col in pk else '') + ('/FK' if col in fk and col in pk else 'FK' if col in fk else '')
        rows.append(f'{key or "·":5} {col}: {typ}' + (' ?' if 'NOT NULL' not in tail else ''))
    x, y = positions[name]
    tables[name] = dict(x=x, y=y, w=350, h=48+len(rows)*28, rows=rows)

# Puntos explícitos: relaciones legibles, sin atravesar las entidades.
edges = [
    ('pedidos', 'envios', 'pedido 1 : 0..1 envio', [(790,400),(815,400),(815,1115),(1415,1115),(1415,1150)], (850,1102)),
    ('mesas', 'pedidos', '1 : 0..N', [(390,235),(440,235)], (398,222)),
    ('pedidos', 'pedidos_comida', '1 : 0..N', [(790,235),(840,235)], (798,222)),
    ('comidas', 'pedidos_comida', '1 : 0..N', [(1240,290),(1190,290)], (1198,277)),
    ('usuarios', 'sesiones_usuarios', '1 : 0..N', [(390,810),(440,810)], (398,797)),
    ('usuarios', 'pedidos', 'Usuario opcional por pedido (id_mesero)', [(215,670),(215,580),(615,580),(615,tables['pedidos']['y']+tables['pedidos']['h'])], (270,565)),
    ('resumenes', 'resumen_comida', '1 : 0..N', [(1190,800),(1240,800)], (1198,787)),
    ('comidas', 'resumen_comida', '1 : 0..N', [(1415,tables['comidas']['y']+tables['comidas']['h']),(1415,670)], (1428,555)),
    ('Unidades', 'Stock', '1 : 0..N', [(390,1200),(440,1200)], (398,1187)),
    ('Stock', 'comida_stock', '1 : 0..N', [(790,1225),(840,1225)], (798,1212)),
    ('comidas', 'comida_stock', 'comidas 1 : 0..N comida_stock', [(1415,382),(1610,382),(1610,1080),(1015,1080),(1015,1150)], (1220,1065)),
]

svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1630" height="1650" viewBox="0 0 1630 1650">',
       '<rect width="1630" height="1650" fill="#f1f5f9"/>',
       '<style>text{font-family:Consolas,monospace;fill:#172033}.row{font-size:13px}.title{font-family:Segoe UI,sans-serif;font-weight:700}</style>',
       '<text class="title" x="40" y="42" font-size="27">NÁCAR · Modelo de base de datos</text>',
       '<text x="40" y="72" font-size="14">MariaDB 10.4+ / MySQL 8.0.16+ · 12 tablas · PK: primaria · FK: foránea · ?: nullable</text>']
for name, t in tables.items():
    x, y, w, h = (t[k] for k in ('x','y','w','h'))
    color = '#6d28d9' if name in ('usuarios','sesiones_usuarios') else '#0f766e'
    svg += [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="white" stroke="#94a3b8"/>',
            f'<path d="M{x+6},{y} H{x+w-6} Q{x+w},{y} {x+w},{y+6} V{y+40} H{x} V{y+6} Q{x},{y} {x+6},{y}" fill="{color}"/>',
            f'<text class="title" x="{x+14}" y="{y+27}" font-size="18" style="fill:white">{name}</text>']
    for i, row in enumerate(t['rows']):
        svg.append(f'<text class="row" x="{x+12}" y="{y+62+i*28}">{escape(row)}</text>')
for source, target, label, pts, labelpos in edges:
    points = ' '.join(f'{x},{y}' for x,y in pts)
    svg += [f'<polyline points="{points}" fill="none" stroke="#475569" stroke-width="2"/>',
            f'<text x="{labelpos[0]}" y="{labelpos[1]}" font-size="{9 if label == "1 : 0..N" else 11}">{escape(label)}</text>']
svg += ['<text x="40" y="1540" font-size="14">Violeta: usuarios y sesiones reales. Los pedidos conservan nombres e identificadores históricos.</text>',
        '<text x="40" y="1567" font-size="14">Nombre y precio del ítem se guardan al pedir. imagen se conserva vacía por compatibilidad con la API.</text>',
        '<text x="40" y="1594" font-size="14">Cada vínculo une un padre con cero o muchos hijos. El detalle y sus restricciones están en restaurante.sql.</text>',
        '<text x="40" y="1621" font-size="14">Inventario: composición del plato. La cantidad de insumo por plato queda pendiente de aprobación.</text>', '</svg>']
(BASE/'diagrama.svg').write_text('\n'.join(svg), encoding='utf-8')

mxfile = ET.Element('mxfile', host='app.diagrams.net')
diagram = ET.SubElement(mxfile, 'diagram', name='Restaurante', id='restaurante')
model = ET.SubElement(diagram, 'mxGraphModel', pageWidth='1700', pageHeight='1700', page='1')
root = ET.SubElement(model, 'root')
ET.SubElement(root, 'mxCell', id='0')
ET.SubElement(root, 'mxCell', id='1', parent='0')
for name,t in tables.items():
    value = f'<b>{name}</b><hr/>' + '<br/>'.join(escape(row).replace(' ', '&nbsp;') for row in t['rows'])
    cell = ET.SubElement(root, 'mxCell', id=name, value=value, vertex='1', parent='1', style='rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=12;fontFamily=Consolas;fontSize=13;fillColor=#ffffff;strokeColor=#0f766e;')
    ET.SubElement(cell, 'mxGeometry', x=str(t['x']), y=str(t['y']), width=str(t['w']), height=str(t['h']), attrib={'as':'geometry'})
for i,(source,target,label,pts,_) in enumerate(edges):
    start_arrow = 'ERzeroToOne' if source == 'usuarios' and target == 'pedidos' else 'ERone'
    cell = ET.SubElement(root,'mxCell',id=f'rel{i}',value=label,edge='1',parent='1',source=source,target=target,style=f'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;startArrow={start_arrow};endArrow={'ERzeroToOne' if target == 'envios' else 'ERzeroToMany'};fontSize=11;')
    geo = ET.SubElement(cell,'mxGeometry',relative='1',attrib={'as':'geometry'})
    array = ET.SubElement(geo,'Array',attrib={'as':'points'})
    for x,y in pts[1:-1]:
        ET.SubElement(array,'mxPoint',x=str(x),y=str(y))
ET.indent(mxfile)
ET.ElementTree(mxfile).write(BASE/'diagrama.drawio',encoding='utf-8',xml_declaration=True)
(BASE/'diagrama-layout.json').write_text(json.dumps({'tables':tables,'edges':edges},ensure_ascii=False),encoding='utf-8')
print('Generados: diagrama.svg, diagrama.drawio y diagrama-layout.json')
