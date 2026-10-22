"""UML de los contratos y objetos reales; SVG, draw.io y Mermaid editables."""
import json
from html import escape
from pathlib import Path
import xml.etree.ElementTree as ET

BASE = Path(__file__).resolve().parent
nodes = [
    ('PaymentDialog', 'componente funcional', 40, 140, ['order: Order', 'payment: Payment | null', '+refresh()', '+run(action)']),
    ('ApiAccess', 'módulo · apiAccess.ts', 440, 140, ['+iniciarPago(id)', '+obtenerPago(id)', '+cancelarPago(id)', '+reembolsarPago(id)']),
    ('Pagos', 'módulo · pagos.js', 840, 140, ['+iniciarPago(id, proveedor)', '+consultarPago(id)', '+cancelarPago(id, actor)', '+reembolsarPago(id, actor)', '+exigirPago(conexion, pedido)']),
    ('RegistroPasarelas', 'módulo · pasarelas.js', 1240, 140, ['proveedores: Map', '+registrarPasarela(codigo, adaptador)', '+obtenerPasarela(codigo)']),
    ('PaymentShare', 'componente funcional', 40, 500, ['url: string', 'orderId: string', 'QR y enlace para el cliente', 'Portapapeles: enlace público']),
    ('Pedido', 'objeto SQL · pedidos', 440, 500, ['id_pedidos: INT (PK)', 'estado: VARCHAR(30)', 'pago_requerido: TINYINT(1)']),
    ('Pago', 'objeto SQL · pagos', 840, 500, ['id_pago: CHAR(36) (PK)', 'id_pedido: INT (FK, UNIQUE)', 'proveedor: VARCHAR(40)', 'estado: VARCHAR(20)', 'importe: DECIMAL(12,2)', 'moneda: CHAR(3)', 'preferencia_id: VARCHAR(200)', 'checkout_url: VARCHAR(2048)', 'referencia_pasarela: VARCHAR(100)', 'reembolso_id: VARCHAR(100)']),
    ('PasarelaPago', 'contrato estructural', 1240, 500, ['+preparar?()', '+crear(pago)', '+consultar(pago)', '+cancelar(pago)', '+reembolsar(pago)']),
    ('CheckoutPublico', 'objeto devuelto por crear()', 40, 1040, ['preferencia_id: string', 'checkout_url: string', 'Cliente paga fuera de NÁCAR']),
    ('PagoQr', 'módulo · pagoQr.ts', 440, 1040, ['+crearQrPago(enlace)', 'Devuelve PNG como data URL', 'Codifica solo el checkout HTTPS']),
    ('MercadoPagoAPI', 'servicio externo HTTPS', 840, 1040, ['GET /users/me', 'POST /checkout/preferences', 'GET /v1/payments/search', 'PUT /checkout/preferences/{id}', 'PUT /v1/payments/{id}', 'POST /v1/payments/{id}/refunds']),
    ('AdaptadorMercadoPago', 'objeto registrado · mercadopago', 1240, 1040, ['nombre: string', '+preparar()', '+crear(pago)', '+consultar(pago)', '+cancelar(pago)', '+reembolsar(pago)']),
]
tables = {}
for name, kind, x, y, rows in nodes:
    tables[name] = dict(x=x, y=y, w=340, h=86+28*len(rows), kind=kind, rows=rows)

# source, target, label, points, label position, UML relation
edges = [
    ('PaymentDialog','ApiAccess','usa',[(380,250),(440,250)],(393,236),'use'),
    ('ApiAccess','Pagos','HTTP',[(780,250),(840,250)],(788,236),'use'),
    ('Pagos','RegistroPasarelas','elige',[(1180,250),(1240,250)],(1190,236),'use'),
    ('PaymentDialog','PaymentShare','muestra',[(210,338),(210,500)],(222,430),'use'),
    ('Pagos','Pago','guarda / consulta',[(1010,366),(1010,500)],(1022,444),'use'),
    ('Pagos','Pedido','valida estado',[(900,366),(900,420),(610,420),(610,500)],(650,408),'use'),
    ('RegistroPasarelas','PasarelaPago','devuelve contrato',[(1410,310),(1410,500)],(1422,420),'use'),
    ('Pedido','Pago','1       0..1',[(780,620),(840,620)],(782,605),'association'),
    ('PaymentShare','CheckoutPublico','comparte URL',[(210,698),(210,1040)],(222,900),'use'),
    ('PaymentShare','PagoQr','genera QR',[(380,620),(410,620),(410,1140),(440,1140)],(420,960),'use'),
    ('AdaptadorMercadoPago','PasarelaPago','implementa',[(1410,1040),(1410,726)],(1422,900),'implements'),
    ('AdaptadorMercadoPago','MercadoPagoAPI','HTTPS',[(1240,1160),(1180,1160)],(1185,1146),'use'),
]

width, height = 1620, 1500
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
       f'<rect width="{width}" height="{height}" fill="#f5f7fb"/>',
       '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L9,5 L0,10" fill="none" stroke="#475569"/></marker><marker id="triangle" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto"><path d="M0,0 L13,7 L0,14 Z" fill="white" stroke="#475569"/></marker></defs>',
       '<style>text{font-family:Segoe UI,sans-serif;fill:#172033}.row{font-family:Consolas,monospace;font-size:13px}.title{font-weight:700}</style>',
       '<text class="title" x="40" y="46" font-size="28">NÁCAR · Integración con Mercado Pago</text>',
       '<text x="40" y="78" font-size="16">Diagrama UML de contratos, módulos y objetos · Implementación actual · 22/10/2026</text>',
       '<text x="40" y="108" font-size="14">React → Axios → rutas Express /api/pagos/:id → lógica de pagos → adaptador → API Mercado Pago</text>']
for name, t in tables.items():
    x,y,w,h = (t[k] for k in ('x','y','w','h'))
    color = '#6d28d9' if name == 'PasarelaPago' else '#0f766e' if name in ('Pedido','Pago') else '#244769'
    svg += [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="white" stroke="#94a3b8"/>',
            f'<rect x="{x}" y="{y}" width="{w}" height="68" fill="{color}"/>',
            f'<text x="{x+12}" y="{y+23}" font-size="12" style="fill:white">«{escape(t["kind"])}»</text>',
            f'<text class="title" x="{x+12}" y="{y+50}" font-size="19" style="fill:white">{name}</text>']
    for i,row in enumerate(t['rows']):
        svg.append(f'<text class="row" x="{x+12}" y="{y+94+i*28}">{escape(row)}</text>')
for source,target,label,points,pos,kind in edges:
    pts = ' '.join(f'{x},{y}' for x,y in points)
    marker = '' if kind == 'association' else f' marker-end="url(#{"triangle" if kind == "implements" else "arrow"})"'
    dash = ' stroke-dasharray="6 4"' if kind in ('use','implements') else ''
    svg += [f'<polyline points="{pts}" fill="none" stroke="#475569" stroke-width="2"{dash}{marker}/>',
            f'<text x="{pos[0]}" y="{pos[1]}" font-size="12">{escape(label)}</text>']
notes = [
    'Los rectángulos con «módulo» o «componente» representan funciones reales; el código no declara clases JavaScript.',
    'PasarelaPago es un contrato estructural documentado: el registro permite agregar adaptadores sin reescribir pedidos.',
    'Pedido y Pago son objetos del modelo relacional (atributos principales). Relación: un pedido tiene cero o un pago.',
    'El QR y el enlace abren el checkout público del pedido en el celular del cliente; no comparten la sesión del administrador.',
    'NÁCAR confirma el pago consultando la API; cancelación previa al despacho solicita devolución con clave idempotente.',
]
for i,note in enumerate(notes):
    svg.append(f'<text x="40" y="{1360+i*26}" font-size="14">{escape(note)}</text>')
svg.append('</svg>')
(BASE/'diagrama-clases-mercadopago.svg').write_text('\n'.join(svg),encoding='utf-8')
(BASE/'diagrama-clases-mercadopago.json').write_text(json.dumps(dict(width=width,height=height,tables=tables,edges=edges,notes=notes),ensure_ascii=False,indent=2),encoding='utf-8')

mxfile = ET.Element('mxfile',host='app.diagrams.net')
diagram = ET.SubElement(mxfile,'diagram',name='Integración Mercado Pago',id='pagos')
model = ET.SubElement(diagram,'mxGraphModel',pageWidth=str(width),pageHeight=str(height),page='1')
root = ET.SubElement(model,'root')
ET.SubElement(root,'mxCell',id='0')
ET.SubElement(root,'mxCell',id='1',parent='0')
for name,t in tables.items():
    value = escape('«'+t['kind']+'»') + f'<br/><b>{name}</b><hr/>' + '<br/>'.join(escape(r) for r in t['rows'])
    cell = ET.SubElement(root,'mxCell',id=name,value=value,vertex='1',parent='1',style='rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=12;fontFamily=Consolas;fontSize=13;fillColor=#ffffff;strokeColor=#244769;')
    ET.SubElement(cell,'mxGeometry',x=str(t['x']),y=str(t['y']),width=str(t['w']),height=str(t['h']),attrib={'as':'geometry'})
for i,(source,target,label,points,pos,kind) in enumerate(edges):
    style='edgeStyle=orthogonalEdgeStyle;html=1;fontSize=12;'
    style+= 'dashed=1;endArrow=block;endFill=0;' if kind=='implements' else 'dashed=1;endArrow=open;' if kind=='use' else 'endArrow=none;'
    cell=ET.SubElement(root,'mxCell',id=f'e{i}',value=label,edge='1',parent='1',source=source,target=target,style=style)
    geo=ET.SubElement(cell,'mxGeometry',relative='1',attrib={'as':'geometry'})
    arr=ET.SubElement(geo,'Array',attrib={'as':'points'})
    for x,y in points[1:-1]: ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))
note=ET.SubElement(root,'mxCell',id='nota',value='<br/>'.join(escape(n) for n in notes),vertex='1',parent='1',style='text;html=1;whiteSpace=wrap;align=left;fontSize=14;')
ET.SubElement(note,'mxGeometry',x='40',y='1360',width='1540',height='130',attrib={'as':'geometry'})
ET.indent(mxfile)
ET.ElementTree(mxfile).write(BASE/'diagrama-clases-mercadopago.drawio',encoding='utf-8',xml_declaration=True)

mermaid=['classDiagram','direction TB']
for name,t in tables.items():
    stereotype = 'interface' if name=='PasarelaPago' else 'SQLObject' if name in ('Pedido','Pago') else 'component' if name in ('PaymentDialog','PaymentShare') else 'module' if name not in ('CheckoutPublico','AdaptadorMercadoPago','MercadoPagoAPI') else 'adapter' if name=='AdaptadorMercadoPago' else 'external' if name=='MercadoPagoAPI' else 'DTO'
    mermaid += [f'class {name} {{', f'  <<{stereotype}>>']
    for row in t['rows']:
        if row.startswith('+') or ': ' in row: mermaid.append('  '+row)
    mermaid.append('}')
for source,target,label,points,pos,kind in edges:
    if kind=='association': mermaid.append('Pedido "1" -- "0..1" Pago : tiene')
    else: mermaid.append(f'{source} {"..|>" if kind=="implements" else "..>"} {target} : {label}')
mermaid += ['note for PasarelaPago "Contrato estructural documentado; implementado por un objeto JavaScript."','note for Pagos "El código usa módulos y funciones; estos símbolos no implican clases class."']
(BASE/'diagrama-clases-mercadopago.mmd').write_text('\n'.join(mermaid)+'\n',encoding='utf-8')
print('Generados SVG, draw.io, Mermaid y datos del diagrama de pagos.')
