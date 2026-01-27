from django.shortcuts import render
from django.http import JsonResponse
from .models import Orders, Order_details, Listings, Cart, Card
from django.http import HttpResponse

def health_check(request):
    return HttpResponse("OK", content_type="text/plain")

