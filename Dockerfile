# Etapa 1: Build
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copiar archivos del Backend
COPY Backend/pom.xml .
COPY Backend/mvnw .
COPY Backend/.mvn .mvn

# Descargar dependencias
RUN mvn dependency:go-offline -B

# Copiar el código fuente
COPY Backend/src ./src

# Compilar
RUN mvn clean package -DskipTests \
    -Dmaven.compiler.verbose=false \
    -Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn

# Etapa 2: Run
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copiar el JAR compilado
COPY --from=build /app/target/*.jar app.jar

# Optimización de memoria para Render Free Tier
ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

EXPOSE 8080

# Ejecutar con opciones de memoria optimizadas
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
