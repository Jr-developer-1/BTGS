# Dedicated signals for the travel app.
# NOTE: Most general model auditing signals (pre_save, post_save, post_delete) 
# have been centralized and migrated to `core/signals.py` for a unified tracking system.
# You can add specific, non-auditing travel app signals here if necessary in the future.

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum
from .models import Expense, TravelClaim

@receiver([post_save, post_delete], sender=Expense)
def update_claim_totals_on_expense_change(sender, instance, **kwargs):
    """
    Automatically updates the related TravelClaim total_amount and approved_amount
    when an Expense is created, updated, or deleted.
    """
    trip = instance.trip
    if not trip:
        return
        
    try:
        claim = trip.claim
    except Exception:
        # No claim associated with this trip yet
        return
        
    # Recalculate totals
    all_exps = trip.expenses.filter(is_deleted=False)
    
    # Sum of original expense amounts
    total_amount = all_exps.aggregate(s=Sum('amount'))['s'] or 0
    claim.total_amount = total_amount
    
    # Recalculate approved_amount: prioritize finance_selected_amount, then hr_selected_amount, then amount (excluding rejected items)
    approved_total = sum(
        (e.finance_selected_amount if e.finance_selected_amount is not None else (e.hr_selected_amount if e.hr_selected_amount is not None else e.amount))
        for e in all_exps if e.status != 'Rejected'
    )
    claim.approved_amount = approved_total

    # Recalculate hr_approved_amount: sum of hr_selected_amount where set, else e.amount (excluding rejected items)
    hr_approved_total = sum(
        (e.hr_selected_amount if e.hr_selected_amount is not None else e.amount)
        for e in all_exps if e.status != 'Rejected'
    )
    claim.hr_approved_amount = hr_approved_total

    # Recalculate executive_approved_amount: prioritize finance_selected_amount, then hr_selected_amount, then e.amount (excluding rejected items)
    exec_approved_total = sum(
        (e.finance_selected_amount if e.finance_selected_amount is not None else (e.hr_selected_amount if e.hr_selected_amount is not None else e.amount))
        for e in all_exps if e.status != 'Rejected'
    )
    claim.executive_approved_amount = exec_approved_total
    
    claim.save(update_fields=['total_amount', 'approved_amount', 'hr_approved_amount', 'executive_approved_amount'])
