# =============================================
# E-Sukan — Multi-stage Dockerfile
# Stage 1: Build with Maven
# Stage 2: Run with slim JRE
# =============================================

# --- BUILD STAGE ---
FROM maven:3.9.6-eclipse-temurin-17 AS builder

WORKDIR /app

# Cache dependencies first (only re-downloads if pom.xml changes)
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests -q

# --- RUN STAGE ---
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -S esukan && adduser -S esukan -G esukan

# Copy built jar from builder
COPY --from=builder /app/target/*.jar app.jar

# Set ownership
RUN chown esukan:esukan app.jar

USER esukan

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
