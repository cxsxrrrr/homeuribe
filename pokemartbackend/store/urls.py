from django import urls
from . import views

urlpatterns = [
    urls.path('health/', views.health_check, name='health_check'),
]