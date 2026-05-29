@echo off
cd /d "%~dp0"

echo ── Configurando identidad Git ──
git config --global user.email "eugenioramirezg@gmail.com"
git config --global user.name "Eugenio Ramirez"

echo ── Inicializando repositorio ──
git init

git remote remove origin 2>nul
git remote add origin https://github.com/EugenioRamirez/Ludovico.git

echo ── Añadiendo todos los cambios ──
git add -A

echo ── Creando commit ──
git commit -m "feat: actualizacion Ludovico app"

echo ── Subiendo a GitHub ──
git push origin master:main

echo.
echo Listo. Pulsa cualquier tecla para cerrar.
pause >nul
