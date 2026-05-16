#!/bin/sh
set -e
if [ -n "$PORT" ]; then
  sed -i "s/port=\"8080\"/port=\"${PORT}\"/" /usr/local/tomcat/conf/server.xml
fi
exec catalina.sh run
