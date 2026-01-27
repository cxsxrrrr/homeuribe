from django.db import models
from django.conf import settings

class Orders(models.Model):
    id = models.AutoField(primary_key=True)
    buyer_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=45)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Orders(id={self.id}, buyer_id={self.buyer_id}, total_price={self.total_price}, status={self.status})"
    
class Order_details(models.Model):
    id = models.AutoField(primary_key=True)
    order_id = models.ForeignKey('Orders', on_delete=models.CASCADE, related_name='order_details')
    listing_id = models.ForeignKey('Listings', on_delete=models.CASCADE, related_name='order_details')
    quantity = models.IntegerField(default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    
class Listings(models.Model):

    CONDITION = [
        ('Graded 10', 'Graded 10'),
        ('Graded 9', 'Graded 9'),
        ('Graded 8', 'Graded 8'),
        ('Near Mint', 'Near Mint'),
        ('Lightly Played', 'Lightly Played'),
        ('Played', 'Played'),
        ('Heavily Played', 'Heavily Played'),
        ('Damaged', 'Damaged'),
        ]

    STATUS = [
        ('Available', 'Available'),
        ('Sold Out', 'Sold Out'),
        ('Inactive', 'Inactive'),
        ]

    id = models.AutoField(primary_key=True)
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='listings')
    card_id = models.ForeignKey('Card', on_delete=models.CASCADE, related_name='listings')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    condition = models.CharField(max_length=50)
    status = models.CharField(max_length=45)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Listings(id={self.id}, seller={self.seller}, card_id={self.card_id}, price={self.price}, quantity={self.quantity})"
    

class Cart(models.Model):

    id = models.AutoField(primary_key=True)
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='carts')
    listing_id = models.ForeignKey('Listings', on_delete=models.CASCADE, related_name='carts')
    quantity = models.IntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Cart(id={self.id}, user_id={self.user_id}, listing_id={self.listing_id}, quantity={self.quantity})"
    

class Card(models.Model):

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    collection = models.CharField(max_length=100)
    rarity = models.CharField(max_length=50)
    image_url = models.URLField(max_length=200)
    recommended_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"Card(id={self.id}, name={self.name}, collection={self.collection}, rarity={self.rarity})"