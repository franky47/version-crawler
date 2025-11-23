#!/usr/bin/env bash
# Example requests to the Repository Dependency Version Discovery API

# Base URL (adjust if your server is running on a different port)
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "Repository Dependency Version Discovery API - Examples"
echo "========================================================"
echo ""

# Example 1: Get service info
echo "1. Get service info:"
echo "   curl $BASE_URL/"
echo ""
curl -s "$BASE_URL/" | jq '.'
echo ""
echo ""

# Example 2: Find React in the React repository
echo "2. Find 'react' in facebook/react repository:"
echo "   curl $BASE_URL/facebook/react/react"
echo ""
# Uncomment to run:
# curl -s "$BASE_URL/facebook/react/react" | jq '.'
echo "(Commented out - uncomment to run)"
echo ""
echo ""

# Example 3: Find TypeScript in TypeScript repository
echo "3. Find 'typescript' in microsoft/TypeScript repository:"
echo "   curl $BASE_URL/microsoft/TypeScript/typescript"
echo ""
# Uncomment to run:
# curl -s "$BASE_URL/microsoft/TypeScript/typescript" | jq '.'
echo "(Commented out - uncomment to run)"
echo ""
echo ""

# Example 4: Find a scoped package
echo "4. Find '@types/node' in a repository:"
echo "   curl $BASE_URL/owner/repo/@types/node"
echo ""
echo "(Example - replace owner/repo with actual values)"
echo ""
echo ""

# Example 5: Query a specific branch
echo "5. Query a specific branch:"
echo "   curl \"$BASE_URL/owner/repo/package-name?branch=develop\""
echo ""
echo "(Example - replace with actual values)"
echo ""
echo ""

# Example 6: Invalid input (demonstrates validation)
echo "6. Invalid owner name (should return 400):"
echo "   curl $BASE_URL/invalid@owner/repo/package"
echo ""
curl -s "$BASE_URL/invalid@owner/repo/package" | jq '.'
echo ""
echo ""

echo "Examples completed!"
