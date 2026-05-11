# H2 in-memory + Jetty on http://localhost:9090/ (requires Maven + JDK 17; esukan.properties default use-h2=true)
Set-Location $PSScriptRoot\..
mvn -q clean package -DskipTests
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
mvn -q org.eclipse.jetty.ee10:jetty-ee10-maven-plugin:12.0.16:run-war
