from django.apps import AppConfig

class TravelConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'travel'
    path = r'c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend\travel'

    def ready(self):
        import travel.signals
