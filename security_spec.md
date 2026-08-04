# Security Specification - StoreSage Multi-Tenant SaaS

This specification documents the strict access control invariants and test payloads for the multi-tenant StoreSage inventory tracking software.

## 1. Core Data Invariants

1. **Strict Multi-Tenant Isolation:**
   - A user with UID `X` assigned to `store_id` = `Y` can **ONLY** read or write documents situated under `/stores/Y/` (e.g., `/stores/Y/products/{productId}`).
   - Direct reads or writes of products inside any other store `/stores/Z/products/{productId}` MUST result in `PERMISSION_DENIED` even if the user is authenticated.

2. **Immutable Identity Profiles:**
   - A user profile under `/users/{uid}` can only be created or written by the authenticated user with that exact `uid`.
   - The user's `store_id` assigned during signup is protected; standard users cannot execute profile updates to self-reassign to another store ID.

3. **Field Type and Range Validation:**
   - Products must hold strict positive ranges for numerical inputs (`price >= 0`, `stock >= 0`, `stock_minimum >= 0`).
   - Essential fields like `sku`, `name`, and `store_id` must conform to layout constraints and cannot be null, empty, or oversized.

---

## 2. The "Dirty Dozen" Rogue Payloads 

The following 12 cyber and logical payload injections represent invalid attempts to bypass security. Our `firestore.rules` must reject all of these:

1. **P1: Cross-Tenant Product Read**
   An authenticated user with `store_id = "UMKM_A"` tries to read a product directly under `/stores/UMKM_B/products/shampoo`.
   *Action:* `get` / `list`
   *Expectation:* `PERMISSION_DENIED`

2. **P2: Cross-Tenant Product Write**
   A user belonging to `UMKM_A` tries to inject a new fake product under `/stores/UMKM_B/products/stolen_item` with brand new stock details.
   *Action:* `create`
   *Expectation:* `PERMISSION_DENIED`

3. **P3: Identity Hijack Profile Read**
   An authenticated user `UID_JOE` attempts to read user profile `/users/UID_BOB` to harvest Bob's assigned `store_id`.
   *Action:* `get`
   *Expectation:* `PERMISSION_DENIED`

4. **P4: Self-Assigned Store Swap**
   An authenticated user `UID_JOE` (working for Store A) attempts to run an `update` on their profile `/users/UID_JOE` switching `store_id` to `"PRIME_STORE_B"` to gain administrative visibility.
   *Action:* `update`
   *Expectation:* `PERMISSION_DENIED`

5. **P5: Store Tenant Spoofing**
   An unauthenticated or rogue user attempts to overwrite the subscription details or name of `/stores/storeId` directly.
   *Action:* `update` / `write`
   *Expectation:* `PERMISSION_DENIED`

6. **P6: Negative Stock Injection**
   An operator attempts to write a product under `/stores/storeId/products/p1` with `stock = -25`.
   *Action:* `create` / `update`
   *Expectation:* `PERMISSION_DENIED`

7. **P7: Oversized String Denial-of-Wallet**
   A competitor attempts to inject a product with a `name` containing a 2MB long repeating character buffer.
   *Action:* `create`
   *Expectation:* `PERMISSION_DENIED` (String size must be bounded: `<= 250` chars)

8. **P8: SKU Field Deletion**
   An operator attempts to update a product but omits the mandatory ID `sku` field, creating an "Update-Gap" in product tracking.
   *Action:* `update`
   *Expectation:* `PERMISSION_DENIED`

9. **P9: Non-Verified Email User Writes**
   An operator with `email_verified = false` attempts to write items. (For applications mandating strict verified access, verified emails are required).
   *Action:* `create`
   *Expectation:* `PERMISSION_DENIED`

10. **P10: Global Blanket Collection Read**
    A rogue user sends an unconstrained request to fetch ALL products globally across all stores (e.g., `db.collectionGroup('products')`).
    *Action:* `list`
    *Expectation:* `PERMISSION_DENIED`

11. **P11: Relational Orphan Creation**
    A product is written to a non-existent or random tenant `/stores/fake_store/products/prod1` where `/stores/fake_store` does not actually exist in the DB.
    *Action:* `create`
    *Expectation:* `PERMISSION_DENIED`

12. **P12: Sibling Field Modification**
    A staff member attempts to change a product's immutable `createdAt` registry flag during a stocking update.
    *Action:* `update`
    *Expectation:* `PERMISSION_DENIED`

---

## 3. Security Test Scenarios

Our Firebase Firestore Rules (`firestore.rules`) will handle these validation criteria securely natively via:
- Isolation gates: `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.store_id == storeId`
- Safe type helper utilities
- Match blocks for all paths defined in `/firebase-blueprint.json`
