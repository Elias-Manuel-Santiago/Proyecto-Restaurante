$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$layout = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'diagrama-layout.json') -Raw -Encoding utf8 | ConvertFrom-Json
$bitmap = [System.Drawing.Bitmap]::new(3260,3100)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.ScaleTransform(2,2)
$graphics.SmoothingMode = 'AntiAlias'
$graphics.TextRenderingHint = 'AntiAliasGridFit'
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#f1f5f9'))
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#172033'))
$font = [System.Drawing.Font]::new('Consolas',9.75)
$small = [System.Drawing.Font]::new('Consolas',8.25)
$cardinality = [System.Drawing.Font]::new('Consolas',6.75)
$title = [System.Drawing.Font]::new('Segoe UI',20.25,[System.Drawing.FontStyle]::Bold)
$heading = [System.Drawing.Font]::new('Segoe UI',13.5,[System.Drawing.FontStyle]::Bold)
$note = [System.Drawing.Font]::new('Consolas',10.5)
$pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#475569'),2)
try {
  $graphics.DrawString('NÁCAR · Modelo de base de datos',$title,$ink,40,12)
  $graphics.DrawString('MariaDB 10.4+ / MySQL 8.0.16+ · 11 tablas · PK: primaria · FK: foránea · ?: nullable',$note,$ink,40,52)
  foreach ($property in $layout.tables.PSObject.Properties) {
    $name = $property.Name
    $table = $property.Value
    $x = [single]$table.x; $y = [single]$table.y
    $graphics.FillRectangle([System.Drawing.Brushes]::White,$x,$y,[single]$table.w,[single]$table.h)
    $color = if ($name -in @('usuarios','sesiones_usuarios')) { '#6d28d9' } else { '#0f766e' }
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($color))
    $graphics.FillRectangle($brush,$x,$y,[single]$table.w,40)
    $brush.Dispose()
    $graphics.DrawRectangle($pen,$x,$y,[single]$table.w,[single]$table.h)
    $graphics.DrawString($name,$heading,[System.Drawing.Brushes]::White,$x+14,$y+7)
    $index = 0
    foreach ($row in $table.rows) {
      $graphics.DrawString([string]$row,$font,$ink,$x+12,$y+46+$index*28)
      $index++
    }
  }
  foreach ($edge in $layout.edges) {
    $points = [System.Drawing.PointF[]]@($edge[3] | ForEach-Object { [System.Drawing.PointF]::new([single]$_[0],[single]$_[1]) })
    $graphics.DrawLines($pen,$points)
    $labelFont = if ($edge[2] -eq '1 : 0..N') { $cardinality } else { $small }
    $graphics.DrawString([string]$edge[2],$labelFont,$ink,[single]$edge[4][0],[single]($edge[4][1]-14))
  }
  $graphics.DrawString('Violeta: acceso futuro. id_mesero admite NULL; mozo_id y mozo_nombre describen al perfil local.',$note,$ink,40,1422)
  $graphics.DrawString('Nombre y precio del ítem se guardan al pedir. imagen se conserva vacía por compatibilidad con la API.',$note,$ink,40,1449)
  $graphics.DrawString('Cada vínculo une un padre con cero o muchos hijos. El detalle y sus restricciones están en restaurante.sql.',$note,$ink,40,1476)
  $graphics.DrawString('Inventario: composición del plato. La cantidad de insumo por plato queda pendiente de aprobación.',$note,$ink,40,1503)
  $bitmap.Save((Join-Path $PSScriptRoot 'diagrama.png'),[System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $bitmap.Dispose(); $ink.Dispose(); $font.Dispose()
  $small.Dispose(); $cardinality.Dispose(); $title.Dispose(); $heading.Dispose(); $note.Dispose(); $pen.Dispose()
}
