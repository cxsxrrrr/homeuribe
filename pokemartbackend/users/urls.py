from django.urls import path
from .views import create_user, get_user

urlpatterns = [
    path('create/', create_user, name='create_user'),
    path('<int:user_id>/', get_user, name='get_user')
]