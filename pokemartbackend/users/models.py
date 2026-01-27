from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    ROLE_CHOICES = [
        ("customer", "Customer"),
        ("seller", "Seller"),
        ("admin", "Admin"),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="customer")
    email = models.EmailField(unique=True)

    def __str__(self):
        return f"User(id={self.id}, username={self.username}, email={self.email}, role={self.role})"