package com.esukan.util;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.io.IOException;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import java.util.Properties;

/**
 * JDBC connection pool (HikariCP). Toggle H2 vs MySQL with {@code esukan.db.use-h2}
 * or environment variable {@code ESUKAN_DB_USE_H2}.
 */
public final class DBConnection {

    private static volatile HikariDataSource dataSource;
    private static volatile Properties appProperties = new Properties();

    private DBConnection() {}

    public static void init() throws IOException {
        if (dataSource != null) {
            return;
        }
        synchronized (DBConnection.class) {
            if (dataSource != null) {
                return;
            }
            Map<String, String> dotenv = DotEnv.loadFromWorkingDirectory();
            Properties p = loadProperties();
            overlayFromDotEnv(p, dotenv);
            appProperties = p;

            boolean useH2 = Boolean.parseBoolean(firstNonBlank(
                    System.getenv("ESUKAN_DB_USE_H2"),
                    dotenv.get("ESUKAN_DB_USE_H2"),
                    System.getProperty("esukan.db.use-h2"),
                    p.getProperty("esukan.db.use-h2", "true")));

            HikariConfig cfg = new HikariConfig();
            if (useH2) {
                cfg.setJdbcUrl(firstNonBlank(System.getenv("ESUKAN_H2_URL"), dotenv.get("ESUKAN_H2_URL"),
                        p.getProperty("esukan.db.h2.url")));
                cfg.setUsername(firstNonBlank(System.getenv("ESUKAN_H2_USER"), dotenv.get("ESUKAN_H2_USER"),
                        p.getProperty("esukan.db.h2.user", "sa")));
                cfg.setPassword(firstNonBlank(System.getenv("ESUKAN_H2_PASSWORD"), dotenv.get("ESUKAN_H2_PASSWORD"),
                        p.getProperty("esukan.db.h2.password", "")));
                cfg.setDriverClassName("org.h2.Driver");
            } else {
                String jdbcUrl = firstNonBlank(System.getenv("SPRING_DATASOURCE_URL"), dotenv.get("SPRING_DATASOURCE_URL"),
                        System.getenv("ESUKAN_MYSQL_URL"), dotenv.get("ESUKAN_MYSQL_URL"),
                        p.getProperty("esukan.db.mysql.url"));
                String user = firstNonBlank(System.getenv("SPRING_DATASOURCE_USERNAME"), dotenv.get("SPRING_DATASOURCE_USERNAME"),
                        System.getenv("ESUKAN_MYSQL_USER"), dotenv.get("ESUKAN_MYSQL_USER"),
                        p.getProperty("esukan.db.mysql.user", "root"));
                String password = firstNonBlank(System.getenv("SPRING_DATASOURCE_PASSWORD"), dotenv.get("SPRING_DATASOURCE_PASSWORD"),
                        System.getenv("ESUKAN_MYSQL_PASSWORD"), dotenv.get("ESUKAN_MYSQL_PASSWORD"),
                        p.getProperty("esukan.db.mysql.password", ""));
                if (jdbcUrl.isBlank()) {
                    throw new IllegalStateException(
                            "MySQL/TiDB mode (ESUKAN_DB_USE_H2=false) requires SPRING_DATASOURCE_URL in .env or environment");
                }
                cfg.setJdbcUrl(jdbcUrl);
                cfg.setUsername(user);
                cfg.setPassword(password);
                cfg.setDriverClassName("com.mysql.cj.jdbc.Driver");
            }
            cfg.setMaximumPoolSize(10);
            cfg.setMinimumIdle(2);
            cfg.setConnectionTimeout(5000); // 5 seconds connection timeout (fail fast)
            cfg.setValidationTimeout(3000); // 3 seconds validation timeout
            dataSource = new HikariDataSource(cfg);
        }
    }

    public static Properties getAppProperties() {
        return appProperties;
    }

    public static Connection getConnection() throws SQLException {
        if (dataSource == null) {
            throw new IllegalStateException("DBConnection not initialized");
        }
        return dataSource.getConnection();
    }

    public static void shutdown() {
        HikariDataSource ds = dataSource;
        dataSource = null;
        if (ds != null) {
            ds.close();
        }
    }

    private static void overlayFromDotEnv(Properties p, Map<String, String> dotenv) {
        mapDotEnv(p, dotenv, "ESUKAN_DB_USE_H2", "esukan.db.use-h2");
        mapDotEnv(p, dotenv, "ESUKAN_JWT_SECRET", "esukan.jwt.secret");
        mapDotEnv(p, dotenv, "ESUKAN_JWT_EXPIRATION_MS", "esukan.jwt.expiration-ms");
        mapDotEnv(p, dotenv, "SPRING_DATASOURCE_URL", "esukan.db.mysql.url");
        mapDotEnv(p, dotenv, "SPRING_DATASOURCE_USERNAME", "esukan.db.mysql.user");
        mapDotEnv(p, dotenv, "SPRING_DATASOURCE_PASSWORD", "esukan.db.mysql.password");
    }

    private static void mapDotEnv(Properties p, Map<String, String> dotenv, String envKey, String propKey) {
        String v = dotenv.get(envKey);
        if (v != null && !v.isBlank()) {
            p.setProperty(propKey, v);
        }
    }

    private static Properties loadProperties() throws IOException {
        Properties p = new Properties();
        try (InputStream in = Thread.currentThread().getContextClassLoader().getResourceAsStream("esukan.properties")) {
            if (in != null) {
                p.load(in);
            }
        }
        return p;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return "";
    }
}
