import os
import django
import sys

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')

# Initialize django without app configs if possible, or just use sqlite3 directly
import sqlite3

db_path = r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend\db.sqlite3"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("RECENT TRIPS:")
cursor.execute("SELECT trip_id, status, current_approver_id, consider_as_local FROM travel_trip ORDER BY created_at DESC LIMIT 5")
for row in cursor.fetchall():
    print(f"ID: {row['trip_id']}, Status: {row['status']}, Current Approver ID: {row['current_approver_id']}, Local: {row['consider_as_local']}")

print("\nRECENT CLAIMS:")
cursor.execute("SELECT id, trip_id, status, current_approver_id FROM travel_travelclaim ORDER BY created_at DESC LIMIT 5")
for row in cursor.fetchall():
    print(f"ID: {row['id']}, Trip ID: {row['trip_id']}, Status: {row['status']}, Current Approver ID: {row['current_approver_id']}")

print("\nFINANCE WORKFLOW STEPS:")
cursor.execute("SELECT user_id, sequence_order, visibility_type, is_active FROM travel_financeworkflowstep")
for row in cursor.fetchall():
    print(f"User ID: {row['user_id']}, Order: {row['sequence_order']}, Visibility: {row['visibility_type']}, Active: {row['is_active']}")

conn.close()
