$WshShell = New-Object -ComObject WScript.Shell

$RutaProyecto = "D:\Proyectos\modosabor1"
$RutaScript = Join-Path $RutaProyecto "ModoSabor.pyw"
$RutaIcono = Join-Path $RutaProyecto "modsabor.ico"
$Escritorio = [Environment]::GetFolderPath("Desktop")
$RutaAccesoDirecto = Join-Path $Escritorio "Modo Sabor.lnk"

$Pythonw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $Pythonw) {
    throw "No encontré pythonw.exe en el sistema."
}

$AccesoDirecto = $WshShell.CreateShortcut($RutaAccesoDirecto)
$AccesoDirecto.TargetPath = $Pythonw
$AccesoDirecto.Arguments = "`"$RutaScript`""
$AccesoDirecto.WorkingDirectory = $RutaProyecto
$AccesoDirecto.IconLocation = $RutaIcono
$AccesoDirecto.Description = "Centro de control de Modo Sabor"
$AccesoDirecto.Save()

Write-Host "Acceso directo creado en: $RutaAccesoDirecto" -ForegroundColor Green
Write-Host "Icono usado: $RutaIcono" -ForegroundColor Cyan
