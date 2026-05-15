import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings

_cached_fernet = None

def _get_fernet():
    global _cached_fernet
    if _cached_fernet is not None:
        return _cached_fernet
        
    password = settings.SECRET_KEY.encode()
    salt = b'tgs_salt_stable_123' 
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password))
    _cached_fernet = Fernet(key)
    return _cached_fernet

def encrypt_key(plain_text):
    if not plain_text:
        return ""
    f = _get_fernet()
    return f.encrypt(plain_text.encode()).decode()

def decrypt_key(cipher_text):
    if not cipher_text:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(cipher_text.encode()).decode()
    except Exception:
        return ""
