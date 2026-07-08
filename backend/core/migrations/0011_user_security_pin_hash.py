from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_userdocument'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='security_pin_hash',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
