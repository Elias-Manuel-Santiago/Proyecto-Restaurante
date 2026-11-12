Add-Type -AssemblyName System.Drawing
$pages = Get-Content -LiteralPath "$PSScriptRoot/modelo.json" -Raw -Encoding utf8 | ConvertFrom-Json
$ink = [Drawing.ColorTranslator]::FromHtml('#24334b')
$brush = [Drawing.SolidBrush]::new($ink)
$font = [Drawing.Font]::new('Arial',15,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
$small = [Drawing.Font]::new('Arial',14,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
$bold = [Drawing.Font]::new('Arial',19,[Drawing.FontStyle]::Bold,[Drawing.GraphicsUnit]::Pixel)
$titleFont = [Drawing.Font]::new('Arial',30,[Drawing.FontStyle]::Bold,[Drawing.GraphicsUnit]::Pixel)
$line = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#718096'),1.5)
$index=0
foreach ($page in $pages) {
  $index++
  $bmp=[Drawing.Bitmap]::new(1680,1300)
  $g=[Drawing.Graphics]::FromImage($bmp)
  $g.Clear([Drawing.Color]::White)
  $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.DrawString($page.title,$titleFont,$brush,60,34)
  foreach ($edge in $page.edges) {
    $pts=@($edge.points | ForEach-Object { [Drawing.PointF]::new([single]$_[0],[single]$_[1]) })
    if ($edge.dep -or $edge.real) { $line.DashStyle=[Drawing.Drawing2D.DashStyle]::Dash } else { $line.DashStyle=[Drawing.Drawing2D.DashStyle]::Solid }
    $g.DrawLines($line,[Drawing.PointF[]]$pts)
    $s=$pts[0]; $t=$pts[-1]
    if ($edge.mult) {
      $g.DrawString($edge.mult[0],$small,$brush,$s.X+8,$s.Y-25)
      $g.DrawString($edge.mult[1],$small,$brush,$t.X-32,$t.Y-25)
    }
    $g.DrawString($edge.label,$small,$brush,($s.X+$t.X)/2+8,($s.Y+$t.Y)/2-23)
  }
  foreach ($prop in $page.nodes.PSObject.Properties) {
    $n=$prop.Value
    $fill=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($n.color))
    $pen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml($n.stroke),1.6)
    $g.FillRectangle([Drawing.Brushes]::White,$n.x,$n.y,$n.w,$n.h)
    $g.DrawRectangle($pen,$n.x,$n.y,$n.w,$n.h)
    $g.FillRectangle($fill,$n.x,$n.y,$n.w,64)
    $g.DrawRectangle($pen,$n.x,$n.y,$n.w,64)
    $format=[Drawing.StringFormat]::new()
    $format.Alignment=[Drawing.StringAlignment]::Center
    $g.DrawString("«$($n.kind)»",$font,$brush,[Drawing.RectangleF]::new($n.x,$n.y+5,$n.w,25),$format)
    $g.DrawString($n.name,$bold,$brush,[Drawing.RectangleF]::new($n.x,$n.y+29,$n.w,28),$format)
    $i=0
    foreach ($s in $n.attrs) { $g.DrawString($s,$font,$brush,$n.x+12,$n.y+76+26*$i); $i++ }
    if ($n.ops.Count) {
      $yy=$n.y+76+26*$n.attrs.Count
      $g.DrawLine($pen,$n.x,$yy,$n.x+$n.w,$yy)
      $i=0
      foreach ($s in $n.ops) { $g.DrawString($s,$font,$brush,$n.x+12,$yy+12+26*$i); $i++ }
    }
    $pen.Dispose(); $fill.Dispose(); $format.Dispose()
  }
  foreach ($note in $page.notes) {
    $x=$note[1]; $y=$note[2]; $w=$note[3]; $h=$note[4]
    $fill=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#fff8e5'))
    $pen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#bd9637'),1)
    $g.FillRectangle($fill,$x,$y,$w,$h); $g.DrawRectangle($pen,$x,$y,$w,$h)
    $g.DrawString($note[0],$font,$brush,[Drawing.RectangleF]::new($x+18,$y+15,$w-36,$h-20))
    $fill.Dispose();$pen.Dispose()
  }
  $bmp.Save("$PSScriptRoot/page-$index.png",[Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
$font.Dispose();$small.Dispose();$bold.Dispose();$titleFont.Dispose();$brush.Dispose();$line.Dispose()
Write-Output "Rendered $index geometry previews."
