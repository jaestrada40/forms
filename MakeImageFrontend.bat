@echo off
setlocal

set "REGISTRY=srv-osnexus01.minfin.gob.gt:8006"
set "IMAGE=%REGISTRY%/portales-formularios-frontend-img:latest"

REM Authenticate interactively. Do not store registry credentials in this file.
docker login %REGISTRY%
if errorlevel 1 exit /b %errorlevel%

REM OpenShift in this cluster requires a Docker Schema 2 manifest, not OCI media types.
docker buildx build --no-cache --provenance=false --sbom=false --output type=registry,oci-mediatypes=false -f Dockerfile.frontend -t %IMAGE% --add-host=srv-osnexus01.minfin.gob.gt:172.18.27.115 .
exit /b %errorlevel%
