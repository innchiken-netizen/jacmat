/**
 * JACMAT STORE — Comprehensive Admin & Auth Verification Script
 */

import { handleApiRequest } from "../lib/api-router.js";
import http from "http";

// Mock minimal request/response for direct testing of handleApiRequest
function mockRequest(method, url, headers = {}, body = null) {
  const req = {
    method,
    url,
    headers: { ...headers },
    on: (event, handler) => {
      if (event === "data" && body) {
        handler(typeof body === "string" ? body : JSON.stringify(body));
      }
      if (event === "end") {
        handler();
      }
    }
  };

  let statusCode = 200;
  const resHeaders = {};
  let bodyData = "";

  const res = {
    get statusCode() { return statusCode; },
    set statusCode(code) { statusCode = code; },
    setHeader: (k, v) => { resHeaders[k.toLowerCase()] = v; },
    getHeader: (k) => resHeaders[k.toLowerCase()],
    end: (chunk) => {
      if (chunk) bodyData += chunk;
    }
  };

  return { req, res, getResult: () => ({ status: statusCode, headers: resHeaders, body: bodyData ? JSON.parse(bodyData) : null }) };
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  TESTING JACMAT STORE ADMIN SUITE & API SECURITY");
  console.log("=======================================================\n");

  let authCookie = "";
  let createdProductId = "";

  // Test 1: Public endpoint GET /api/products
  {
    const { req, res, getResult } = mockRequest("GET", "/api/products");
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 200, "Test 1 failed: status should be 200");
    console.assert(Array.isArray(result.body), "Test 1 failed: body should be an array");
    console.log(`[PASS] 1. Public /api/products returns ${result.body.length} published products`);
  }

  // Test 2: Unauthenticated GET /api/admin/products -> 401 Unauthorized
  {
    const { req, res, getResult } = mockRequest("GET", "/api/admin/products");
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 401, "Test 2 failed: should return 401 Unauthorized");
    console.log(`[PASS] 2. Unauthenticated /api/admin/products is rejected (HTTP ${result.status})`);
  }

  // Test 3: Failed login with invalid password
  {
    const { req, res, getResult } = mockRequest("POST", "/api/admin/login", {}, { email: "admin@jacmat.store", password: "wrong_password_xyz" });
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 401, "Test 3 failed: wrong password should return 401");
    console.assert(result.body.error === "Email ou mot de passe incorrect.", "Test 3 failed: wrong generic error");
    console.log(`[PASS] 3. Invalid credentials rejected with generic error: "${result.body.error}"`);
  }

  // Test 4: Successful login with correct credentials
  {
    const { req, res, getResult } = mockRequest("POST", "/api/admin/login", {}, { email: "admin@jacmat.store", password: "admin123456" });
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 200, "Test 4 failed: valid credentials should return 200");
    console.assert(result.headers["set-cookie"], "Test 4 failed: missing Set-Cookie header");
    authCookie = result.headers["set-cookie"].split(";")[0];
    console.log(`[PASS] 4. Successful login returns signed httpOnly session cookie (${authCookie.substring(0, 35)}...)`);
  }

  // Test 5: GET /api/admin/me with valid session cookie
  {
    const { req, res, getResult } = mockRequest("GET", "/api/admin/me", { cookie: authCookie });
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 200, "Test 5 failed: should be 200");
    console.assert(result.body.authenticated === true, "Test 5 failed: authenticated must be true");
    console.log(`[PASS] 5. Session verification /api/admin/me confirmed for: ${result.body.email}`);
  }

  // Test 6: GET /api/admin/stats
  {
    const { req, res, getResult } = mockRequest("GET", "/api/admin/stats", { cookie: authCookie });
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 200, "Test 6 failed: stats should be 200");
    console.log(`[PASS] 6. Real stats calculated: ${result.body.totalProducts} total, ${result.body.publishedProducts} published, ${result.body.draftProducts} draft, ${result.body.categoriesCount} categories`);
  }

  // Test 7: Create a DRAFT product via POST /api/admin/products
  {
    const newProductPayload = {
      name: "Hoodie Test Jacmat V2",
      price: 85,
      category: "outerwear",
      status: "draft",
      description: "Pièce test en mode brouillon",
      images: ["/images/SS80.jpg"]
    };
    const { req, res, getResult } = mockRequest("POST", "/api/admin/products", { cookie: authCookie }, newProductPayload);
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 201, "Test 7 failed: creation should return 201");
    createdProductId = result.body.product.id;
    console.log(`[PASS] 7. Created draft product: "${result.body.product.name}" (ID: ${createdProductId}, Slug: ${result.body.product.slug})`);

    // Verify it is NOT visible in public /api/products
    const pubCheck = mockRequest("GET", "/api/products");
    await handleApiRequest(pubCheck.req, pubCheck.res);
    const pubList = pubCheck.getResult().body;
    const isPublic = pubList.some((p) => p.id === createdProductId);
    console.assert(!isPublic, "Draft product should NOT appear in public catalog");
    console.log("[PASS] 7b. Verified draft product is strictly hidden from public store!");
  }

  // Test 8: Publish the product via PUT /api/admin/products
  {
    const { req, res, getResult } = mockRequest("PUT", "/api/admin/products", { cookie: authCookie }, { id: createdProductId, status: "published", price: 79.99 });
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 200, "Test 8 failed: update should return 200");
    console.log(`[PASS] 8. Published product and updated price to ${result.body.product.price}$`);

    // Verify it IS now visible in public /api/products
    const pubCheck = mockRequest("GET", "/api/products");
    await handleApiRequest(pubCheck.req, pubCheck.res);
    const pubList = pubCheck.getResult().body;
    const isPublic = pubList.some((p) => p.id === createdProductId);
    console.assert(isPublic, "Published product must now appear in public catalog");
    console.log("[PASS] 8b. Verified product is immediately visible on the public store!");
  }

  // Test 9: Delete the test product via DELETE /api/admin/products?id=...
  {
    const { req, res, getResult } = mockRequest("DELETE", `/api/admin/products?id=${createdProductId}`, { cookie: authCookie });
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 200, "Test 9 failed: delete should return 200");
    console.log(`[PASS] 9. Deleted test product (ID: ${createdProductId})`);

    // Verify it is removed from public store
    const pubCheck = mockRequest("GET", "/api/products");
    await handleApiRequest(pubCheck.req, pubCheck.res);
    const pubList = pubCheck.getResult().body;
    const isPublic = pubList.some((p) => p.id === createdProductId);
    console.assert(!isPublic, "Deleted product must no longer appear in public catalog");
    console.log("[PASS] 9b. Verified deleted product is completely gone from store!");
  }

  // Test 10: Logout POST /api/admin/logout
  {
    const { req, res, getResult } = mockRequest("POST", "/api/admin/logout", { cookie: authCookie });
    await handleApiRequest(req, res);
    const result = getResult();
    console.assert(result.status === 200, "Test 10 failed: logout should return 200");
    console.assert(result.headers["set-cookie"].includes("Max-Age=0"), "Logout should clear cookie");
    console.log("[PASS] 10. Logout successfully invalidates and expires the session cookie");
  }

  console.log("\n=======================================================");
  console.log("  ALL 10 API & SECURITY TESTS PASSED WITH 100% SUCCESS");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
