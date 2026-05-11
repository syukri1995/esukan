# =============================================
# E-Sukan — Multi-stage build (Jakarta Servlet WAR on Tomcat 10)
# =============================================

FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -q

COPY src ./src
RUN mvn clean package -DskipTests -q

FROM tomcat:10.1.34-jre17-temurin-jammy

RUN rm -rf /usr/local/tomcat/webapps/*

COPY --from=builder /app/target/esukan.war /usr/local/tomcat/webapps/ROOT.war

ENV ESUKAN_DB_USE_H2=false

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/index.html >/dev/null || exit 1

CMD ["catalina.sh", "run"]
