from django.http import JsonResponse
import json
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

User = get_user_model()

@csrf_exempt
@require_http_methods(["POST"])
def create_user(request):
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "Invalid JSON payload."}, status=400)

    required_fields = {"username", "email", "password"}
    
    if not required_fields.issubset(payload):
        return JsonResponse({"error": "Missing required fields."}, status=400)

    if User.objects.filter(username=payload["username"]).exists():
        return JsonResponse({"error": "Username already exists."}, status=409)

    user = User.objects.create_user(
        username=payload["username"],
        email=payload["email"],
        password=payload["password"]
    )
    return JsonResponse({"id": user.id, "username": user.username, "email": user.email}, status=201)

@csrf_exempt
@require_http_methods(["GET"])
def get_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)
    return JsonResponse({"id": user.id, "username": user.username, "email": user.email}, status=200)