#!/usr/bin/env bash
# ==============================================================================
# Smart Meal Management — Developer & App Client CLI Tool
# ==============================================================================
# Usage:
#   ./cli.sh health
#   ./cli.sh register "Jane Doe" "jane@example.com" "Password123!"
#   ./cli.sh login "jane@example.com" "Password123!"
#   ./cli.sh me
#   ./cli.sh dashboard
#   ./cli.sh onboard
#   ./cli.sh generate-plan
#   ./cli.sh current-plan
#   ./cli.sh shopping-list
#   ./cli.sh finish-shopping
#   ./cli.sh pantry
#   ./cli.sh add-pantry "Olive Oil" "Pantry Staples" 1 "bottle"
#   ./cli.sh tasks
#   ./cli.sh add-task "Buy almond milk" "From Trader Joe's"
#   ./cli.sh upload-image /path/to/dish.jpg
# ==============================================================================

BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"
SESSION_FILE="${HOME}/.smartmeal_session.json"

function get_token() {
  if [ -f "$SESSION_FILE" ]; then
    grep -o '"accessToken":"[^"]*' "$SESSION_FILE" | grep -o '[^"]*$'
  else
    echo ""
  fi
}

function save_session() {
  echo "$1" > "$SESSION_FILE"
  chmod 600 "$SESSION_FILE"
}

function check_curl_jq() {
  if ! command -v curl &> /dev/null; then
    echo "❌ Error: curl is required."
    exit 1
  fi
}

check_curl_jq
CMD="$1"

case "$CMD" in
  health)
    echo "🔍 Checking API & Database Health..."
    curl -s -X GET "${BASE_URL}/health" | jq . 2>/dev/null || curl -s -X GET "${BASE_URL}/health"
    ;;

  register)
    NAME="${2:-Test User}"
    EMAIL="${3:-testuser@example.com}"
    PASS="${4:-Password123!}"
    echo "📝 Registering user: $EMAIL..."
    curl -s -X POST "${BASE_URL}/auth/register" \
      -H "Content-Type: application/json" \
      -d "{\"fullName\": \"$NAME\", \"email\": \"$EMAIL\", \"password\": \"$PASS\"}" | jq . 2>/dev/null || cat
    ;;

  login)
    EMAIL="${2:-testuser@example.com}"
    PASS="${3:-Password123!}"
    echo "🔑 Logging in as: $EMAIL..."
    RES=$(curl -s -X POST "${BASE_URL}/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$EMAIL\", \"password\": \"$PASS\"}")
    
    TOKEN=$(echo "$RES" | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
    if [ -n "$TOKEN" ]; then
      save_session "$RES"
      echo "✅ Login successful! Session stored in $SESSION_FILE"
      echo "$RES" | jq . 2>/dev/null || echo "$RES"
    else
      echo "❌ Login failed:"
      echo "$RES" | jq . 2>/dev/null || echo "$RES"
    fi
    ;;

  me)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session found. Please run: ./cli.sh login <email> <password>"
      exit 1
    fi
    echo "👤 Fetching active profile..."
    curl -s -X GET "${BASE_URL}/auth/me" \
      -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || cat
    ;;

  dashboard)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    echo "📊 Fetching aggregated user dashboard..."
    curl -s -X GET "${BASE_URL}/users/dashboard" \
      -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || cat
    ;;

  onboard)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    echo "🚀 Completing 8-step onboarding flow & auto-populating pantry staples..."
    curl -s -X POST "${BASE_URL}/users/onboarding/complete" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "displayName": "Home Chef",
        "adultsCount": 2,
        "childrenCount": 1,
        "plannedMealTypes": ["BREAKFAST", "LUNCH", "DINNER"],
        "plannedDaysCount": 7,
        "weeklyBudget": 150.0,
        "mealVibes": ["QUICK_EASY", "HIGH_PROTEIN"],
        "kitchenEquipment": ["AIR_FRYER", "OVEN", "HOB"],
        "pantryStaples": ["Olive Oil", "Garlic", "Rice", "Eggs", "Pasta", "Black Pepper"],
        "dietaryRestrictions": ["HIGH_PROTEIN"],
        "cuisinePreferences": ["MEDITERRANEAN", "ITALIAN", "ASIAN"],
        "currency": "USD"
      }' | jq . 2>/dev/null || cat
    ;;

  generate-plan)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    echo "🤖 Generating AI weekly meal plan via ChatGPT..."
    curl -s -X POST "${BASE_URL}/meal-plans/generate" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "weeklyBudget": 150.0,
        "plannedDaysCount": 7,
        "includePantryItems": true
      }' | jq . 2>/dev/null || cat
    ;;

  current-plan)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    echo "🥗 Fetching current active weekly meal plan..."
    curl -s -X GET "${BASE_URL}/meal-plans/current" \
      -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || cat
    ;;

  shopping-list)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    echo "🛒 Fetching deductive grocery shopping list..."
    curl -s -X GET "${BASE_URL}/shopping-list" \
      -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || cat
    ;;

  finish-shopping)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    ACTUAL_SPEND="${2:-42.50}"
    echo "💳 Finishing shopping session with actual spend: \$$ACTUAL_SPEND..."
    curl -s -X POST "${BASE_URL}/shopping-list/finish" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"checkedItems\": [
          {\"name\": \"Chicken Breast\", \"category\": \"Meat & Fish\"},
          {\"name\": \"Heavy Cream\", \"category\": \"Dairy\"},
          {\"name\": \"Avocado\", \"category\": \"Produce\"}
        ],
        \"actualCost\": $ACTUAL_SPEND
      }" | jq . 2>/dev/null || cat
    ;;

  pantry)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    echo "🥫 Fetching pantry stock..."
    curl -s -X GET "${BASE_URL}/pantry" \
      -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || cat
    ;;

  add-pantry)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    NAME="${2:-Extra Virgin Olive Oil}"
    CAT="${3:-Pantry Staples}"
    QTY="${4:-1.0}"
    UNIT="${5:-bottle}"
    echo "➕ Adding item to pantry: $NAME..."
    curl -s -X POST "${BASE_URL}/pantry" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"ingredientName\": \"$NAME\",
        \"category\": \"$CAT\",
        \"quantity\": $QTY,
        \"unit\": \"$UNIT\"
      }" | jq . 2>/dev/null || cat
    ;;

  tasks)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    echo "📋 Fetching household tasks..."
    curl -s -X GET "${BASE_URL}/tasks" \
      -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || cat
    ;;

  add-task)
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
      echo "❌ No active session. Please run login first."
      exit 1
    fi
    TITLE="${2:-Grocery Pickup}"
    DESC="${3:-Pickup pre-ordered groceries from local market}"
    echo "➕ Creating task: $TITLE..."
    curl -s -X POST "${BASE_URL}/tasks" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"title\": \"$TITLE\", \"description\": \"$DESC\"}" | jq . 2>/dev/null || cat
    ;;

  upload-image)
    IMG_PATH="$2"
    if [ -z "$IMG_PATH" ] || [ ! -f "$IMG_PATH" ]; then
      echo "❌ Error: Please provide a valid image file path."
      echo "Usage: ./cli.sh upload-image /path/to/image.jpg"
      exit 1
    fi
    echo "☁️ Uploading image to S3..."
    curl -s -X POST "${BASE_URL}/upload/image" \
      -F "file=@$IMG_PATH" | jq . 2>/dev/null || cat
    ;;

  *)
    echo "=========================================================="
    echo " Smart Meal Management — CLI Developer Utility"
    echo "=========================================================="
    echo "Commands:"
    echo "  ./cli.sh health                            Check server & DB status"
    echo "  ./cli.sh register <name> <email> <pass>    Register new user"
    echo "  ./cli.sh login <email> <pass>              Login and save token session"
    echo "  ./cli.sh me                                Fetch active user profile"
    echo "  ./cli.sh dashboard                         Get aggregated home screen stats"
    echo "  ./cli.sh onboard                           Complete 8-step onboarding"
    echo "  ./cli.sh generate-plan                     Trigger AI weekly meal plan"
    echo "  ./cli.sh current-plan                      Get active meal plan & budget"
    echo "  ./cli.sh shopping-list                     Get deductive shopping list"
    echo "  ./cli.sh finish-shopping [spend]           Log shopping spend & transfer stock"
    echo "  ./cli.sh pantry                            List pantry inventory"
    echo "  ./cli.sh add-pantry <item> <cat> <qty> <u> Add item to pantry"
    echo "  ./cli.sh tasks                             List household tasks"
    echo "  ./cli.sh add-task <title> <desc>           Create household task"
    echo "  ./cli.sh upload-image <path>               Upload image file to AWS S3"
    echo "=========================================================="
    ;;
esac
