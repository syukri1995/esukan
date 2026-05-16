# Free backend on Render (Docker + TiDB). Run from CSC584_GroupProject.
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\repo-target.ps1"
Set-Location $PSScriptRoot\..

Write-Host @"

=== E-Sukan API — Render (free tier) ===

1. Open the one-click Blueprint (log in to Render if asked):
   $EsukanRenderDeployUrl

2. When prompted for secret env vars, use values from your .env (TiDB Cloud):
   - SPRING_DATASOURCE_URL  (use esukan_db; drop serverSslCert= Windows path)
     Example:
     jdbc:mysql://gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/esukan_db?sslMode=VERIFY_IDENTITY&enabledTLSProtocols=TLSv1.2,TLSv1.3
   - SPRING_DATASOURCE_USERNAME
   - SPRING_DATASOURCE_PASSWORD

3. After deploy (~5–10 min), copy the service URL (e.g. https://esukan-api.onrender.com).

4. Set Vercel BACKEND_URL and redeploy frontend:
   npx vercel env add BACKEND_URL production
   (paste API URL, no trailing slash)
   npx vercel deploy --prod

5. TiDB Cloud: allow external connections (0.0.0.0/0 or Render egress) if connect fails.

"@

Start-Process $EsukanRenderDeployUrl
