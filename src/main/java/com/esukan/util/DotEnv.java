package com.esukan.util;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/** Loads {@code .env} from the process working directory (project root when using Maven). */
public final class DotEnv {

    private DotEnv() {}

    public static Map<String, String> loadFromWorkingDirectory() {
        try {
            return load(Path.of(System.getProperty("user.dir"), ".env"));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read .env", e);
        }
    }

    public static Map<String, String> load(Path envFile) throws IOException {
        if (!Files.isRegularFile(envFile)) {
            return Map.of();
        }
        Map<String, String> out = new HashMap<>();
        for (String raw : Files.readAllLines(envFile)) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            int eq = line.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String key = line.substring(0, eq).trim();
            String value = line.substring(eq + 1).trim();
            if ((value.startsWith("\"") && value.endsWith("\""))
                    || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length() - 1);
            }
            out.put(key, value);
        }
        return Collections.unmodifiableMap(out);
    }
}
