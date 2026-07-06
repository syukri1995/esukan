# ADR 001: Payment Verification & Backward-Compatible Reference IDs

## Status
Accepted

## Context
We are implementing a secure, public payment verification page accessible via QR codes printed on transaction receipts. 
This requires:
1. Generating a non-guessable transaction reference string (`reference_id`).
2. Supporting legacy payments that were created before the `reference_id` database column existed.
3. Ensuring compatibility across both H2 (in-memory dev) and MySQL/TiDB (production) databases.

## Decisions
1. **UUID Reference Generation**: Newly created payments generate a random UUID as their `reference_id`.
2. **Nullable Unique Database Column**: The `reference_id` column in the `payments` table is defined as `VARCHAR(50) NULL UNIQUE`. This allows existing legacy rows to contain `NULL` without violating the unique constraint, which behaves consistently in both H2 and MySQL/TiDB.
3. **Legacy Format Mismatch Prevention**: Legacy reference generation is updated to use the payment record's `createdAt` date (`pay.getCreatedAt()`) instead of the current system clock (`LocalDate.now()`). This prevents mismatches for payments created near midnight.
4. **Format-Aware Verification Lookup**: The `PaymentVerificationServlet` will inspect the incoming reference string:
   * If it matches the legacy pattern (`ESP-YYYYMMDD-XXXXX`), it extracts the primary key ID and verifies the transaction using the payment's properties.
   * If it is a UUID, it queries the database directly by the `reference_id` column.

## Consequences
* New payments have secure, unguessable reference IDs.
* Legacy receipts remain fully verifiable (backward compatibility is preserved).
* Schema migrations remain clean and database-agnostic.
