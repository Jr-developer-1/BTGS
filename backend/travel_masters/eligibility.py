import json
from travel_masters.models import Cadre, EligibilityRule, Location
from travel.models import Expense

def compute_allowance_for_claim(claim):
    # 1. Resolve user cadre based on designation keywords
    user = claim.trip.user if claim.trip else None
    desig = (user.designation or '').strip().lower() if user else ''
    matched_cadre = None
    
    if desig:
        # Build list of (keyword, cadre) tuples
        keyword_cadre_pairs = []
        for cadre in Cadre.objects.all():
            for kw in (cadre.designation_keywords or []):
                if kw:
                    keyword_cadre_pairs.append((str(kw).strip().lower(), cadre))
        
        # Sort by keyword length descending (longer/more specific matches first)
        keyword_cadre_pairs.sort(key=lambda x: len(x[0]), reverse=True)
        
        import re
        desig_words = re.findall(r'[a-z0-9]+', desig)
        desig_words_set = set(desig_words)
        
        for kw_clean, cadre in keyword_cadre_pairs:
            kw_words = re.findall(r'[a-z0-9]+', kw_clean)
            if not kw_words:
                continue
            # Check word-based match
            if all(word in desig_words_set for word in kw_words):
                matched_cadre = cadre
                break
            # Fallback to direct substring
            if kw_clean in desig:
                matched_cadre = cadre
                break
            
    # Role fallbacks if no cadre matched
    if not matched_cadre and user:
        role = getattr(user, 'active_role', '').lower()
        if role in ['admin', 'cfo']:
            matched_cadre = Cadre.objects.filter(name__icontains='ADMINISTRATIVE').first()
        elif role in ['hr', 'finance']:
            matched_cadre = Cadre.objects.filter(name__icontains='MANAGERS').first()

    # Default fallback
    if not matched_cadre:
        matched_cadre = Cadre.objects.filter(name__icontains='BELOW EXECUTIVE').first()
    if not matched_cadre:
        matched_cadre = Cadre.objects.first()

    # Get global policy status
    try:
        from api_management.models import SystemConfig
        config = SystemConfig.objects.filter(key='global_policy_enabled').first()
        global_policy_enabled = config.value.lower() == 'true' if config else True
    except Exception:
        global_policy_enabled = True

    # Fetch eligibility rule (active or inactive)
    rule_obj = EligibilityRule.objects.filter(cadre=matched_cadre).order_by('-id').first() if matched_cadre else None
    rule_active = rule_obj.is_active if rule_obj else False
    policy_enforced = global_policy_enabled and rule_active

    if not policy_enforced:
        expense_allowances = []
        expenses = claim.trip.expenses.filter(is_deleted=False) if claim.trip else []
        for exp in expenses:
            claimed = float(exp.amount)
            expense_allowances.append({
                "expense_id": exp.id,
                "claimed_amount": claimed,
                "allowed_amount": claimed,
                "exceeds_limit": False,
                "city_type": "Others",
                "policy_note": ""
            })
        return {
            "cadre": matched_cadre.name if matched_cadre else "Unknown",
            "expense_allowances": expense_allowances
        }

    # Fetch active eligibility rule
    rule = rule_obj

    # Fallback/default values if no rule exists
    if not rule:
        class DummyRule:
            air_allowed = False
            air_class = "NA"
            train_allowed = True
            train_class = "Sleeper or Equivalent"
            bus_allowed = True
            bus_class = "A/c. Bus or Equivalent"
            car_allowed = False
            car_notes = "NA"
            local_conveyance_allowed = True
            local_conveyance_type = "Online 2 or 3 Wheeler"
            accommodation_state_hq = 800
            accommodation_districts = 500
            accommodation_others = 300
            daily_allowance_amount = 300
            monthly_tour_daily_allowance_amount = 300
            own_stay_state_hq_pct = 50
            own_stay_districts_pct = 50
            own_stay_others_pct = 50
            state_hq_clusters = ['Metropolitan']
            districts_clusters = ['Town', 'City']
            others_clusters = ['Others']
            
            def get_accommodation_limit(self, city_type):
                ct = (city_type or '').strip().lower()
                if ct == 'state hq':
                    return float(self.accommodation_state_hq)
                elif ct == 'districts':
                    return float(self.accommodation_districts)
                else:
                    return float(self.accommodation_others)
                    
            def get_own_stay_limit(self, city_type):
                ct = (city_type or '').strip().lower()
                if ct == 'state hq':
                    return round((float(self.own_stay_state_hq_pct) / 100) * float(self.accommodation_state_hq), 2)
                elif ct == 'districts':
                    return round((float(self.own_stay_districts_pct) / 100) * float(self.accommodation_districts), 2)
                else:
                    return round((float(self.own_stay_others_pct) / 100) * float(self.accommodation_others), 2)
        rule = DummyRule()

    # Resolve destination location & city_type
    destination_name = claim.trip.destination if claim.trip else ''
    loc = Location.objects.filter(name__iexact=destination_name).first() if destination_name else None
    
    city_type = "Others"
    if loc and loc.cluster_category:
        cluster_cat = loc.cluster_category.strip()
        state_hq_cats = [c.lower() for c in (rule.state_hq_clusters or ['Metropolitan'])]
        districts_cats = [c.lower() for c in (rule.districts_clusters or ['Town', 'City'])]
        
        if cluster_cat.lower() in state_hq_cats:
            city_type = "State HQ"
        elif cluster_cat.lower() in districts_cats:
            city_type = "Districts"

    # Pre-scan for Guest House stay in accommodation expenses under this trip
    has_guest_house_stay = False
    expenses = claim.trip.expenses.filter(is_deleted=False) if claim.trip else []
    for exp in expenses:
        if (exp.category or '').strip().lower() == 'accommodation':
            desc = exp.description or ''
            accom_type = ''
            if desc.startswith('{'):
                try:
                    parsed = json.loads(desc)
                    accom_type = parsed.get('accomType', '')
                except:
                    pass
            if not accom_type:
                accom_type = desc
            
            accom_type_lower = str(accom_type).strip().lower()
            if 'guest house' in accom_type_lower or 'guesthouse' in accom_type_lower:
                has_guest_house_stay = True
                break

    expense_allowances = []
    for exp in expenses:
        raw_category = (exp.category or '').strip().lower()

        # Parse description JSON first so we can inspect 'nature' before remapping
        details = {}
        desc = exp.description or ''
        if desc.startswith('{'):
            try:
                details = json.loads(desc)
            except:
                pass

        # Smart category resolution for 'Others':
        # If description contains nature='Daily Allowance', treat as daily_allowance.
        # Otherwise fall back to legacy 'travel' remapping.
        if raw_category == 'others':
            nature = str(details.get('nature', '')).strip().lower()
            if nature == 'daily allowance':
                category = 'daily_allowance'
            else:
                category = 'travel'
        elif raw_category == 'fuel':
            category = 'local travel'
        else:
            category = raw_category

        claimed = float(exp.amount)
        allowed = None
        exceeds = False
        note = ""

        city_type_resolved = city_type

        if category == 'accommodation':
            accom_type = details.get('accomType', desc)
            accom_type_lower = str(accom_type).strip().lower()
            
            # Resolve specific location for this accommodation card
            specific_location = details.get('location', '')
            target_location = specific_location if specific_location else (claim.trip.destination if claim.trip else '')
            if target_location:
                target_location = target_location.strip()
                if " - " in target_location:
                    target_location = target_location.split(" - ")[0].strip()
            
            loc = Location.objects.filter(name__iexact=target_location).first() if target_location else None
            
            city_type_acc = "Others"
            if loc and loc.cluster_category:
                cluster_cat = loc.cluster_category.strip()
                state_hq_cats = [c.lower() for c in (rule.state_hq_clusters or ['Metropolitan'])]
                districts_cats = [c.lower() for c in (rule.districts_clusters or ['Town', 'City'])]
                
                if cluster_cat.lower() in state_hq_cats:
                    city_type_acc = "State HQ"
                elif cluster_cat.lower() in districts_cats:
                    city_type_acc = "Districts"

            city_type_resolved = city_type_acc

            if 'guest house' in accom_type_lower or 'guesthouse' in accom_type_lower:
                allowed = 0.0
                exceeds = claimed > 0.0
                note = "Stay in company guest house is free. Stay amount is not applicable."
            elif 'own stay' in accom_type_lower or 'self stay' in accom_type_lower:
                pct = 50.0
                if city_type_acc == 'State HQ':
                    pct = float(rule.own_stay_state_hq_pct)
                elif city_type_acc == 'Districts':
                    pct = float(rule.own_stay_districts_pct)
                else:
                    pct = float(rule.own_stay_others_pct)
                
                # Retrieve the lodging limit for this city type
                hotel_limit = float(rule.get_accommodation_limit(city_type_acc))
                
                # Calculate actual nights stayed from details
                nights = 0
                check_in = details.get('actualCheckInDate') or details.get('checkInDate') or details.get('checkIn')
                check_out = details.get('actualCheckOutDate') or details.get('checkOutDate') or details.get('checkOut')
                if check_in and check_out:
                    try:
                        from datetime import datetime
                        in_dt = datetime.strptime(str(check_in)[:10], "%Y-%m-%d")
                        out_dt = datetime.strptime(str(check_out)[:10], "%Y-%m-%d")
                        nights = max(0, (out_dt - in_dt).days)
                    except:
                        try:
                            nights = int(details.get('nights', 0))
                        except:
                            pass
                else:
                    try:
                        nights = int(details.get('nights', 0))
                    except:
                        pass
                
                allowed_limit = round(hotel_limit * nights * (pct / 100.0), 2)
                allowed = min(claimed, allowed_limit)
                exceeds = claimed > allowed_limit
                note = f"For own stay, you will only be reimbursed up to {int(pct)}% of the lodging limit (Allowed: ₹{allowed_limit} for {nights} night(s) in {city_type_acc} cities)."
            else:
                # Regular Hotel stay
                # Calculate actual nights stayed from details
                nights = 0
                check_in = details.get('actualCheckInDate') or details.get('checkInDate') or details.get('checkIn')
                check_out = details.get('actualCheckOutDate') or details.get('checkOutDate') or details.get('checkOut')
                if check_in and check_out:
                    try:
                        from datetime import datetime
                        in_dt = datetime.strptime(str(check_in)[:10], "%Y-%m-%d")
                        out_dt = datetime.strptime(str(check_out)[:10], "%Y-%m-%d")
                        nights = max(0, (out_dt - in_dt).days)
                    except:
                        try:
                            nights = int(details.get('nights', 0))
                        except:
                            pass
                else:
                    try:
                        nights = int(details.get('nights', 0))
                    except:
                        pass
                
                limit = rule.get_accommodation_limit(city_type_acc)
                allowed = float(limit) * nights
                exceeds = claimed > allowed
                if exceeds:
                    note = f"Accommodation amount ₹{claimed} exceeds your policy limit of ₹{allowed} for {nights} night(s) in {city_type_acc} cities."
        
        elif category == 'food':
            is_local = claim.trip.consider_as_local if (claim and claim.trip) else False
            if is_local:
                per_day_limit = float(getattr(rule, 'monthly_tour_daily_allowance_amount', rule.daily_allowance_amount))
            else:
                per_day_limit = float(rule.daily_allowance_amount)
            
            # Sum all food expenses on the same date as this expense
            exp_date = str(exp.date)[:10] if exp.date else ''
            daily_food_total = sum(
                float(e.amount)
                for e in expenses
                if (e.category or '').strip().lower() == 'food' and str(e.date)[:10] == exp_date
            )
            
            allowed = per_day_limit
            exceeds = daily_food_total > per_day_limit
            if exceeds:
                if has_guest_house_stay:
                    note = f"Daily food allowance for this date (₹{daily_food_total:.2f}) exceeds the limit of ₹{per_day_limit:.2f}/day."
                else:
                    note = f"Daily allowance for this date (₹{daily_food_total:.2f}) exceeds the limit of ₹{per_day_limit:.2f}/day."

        elif category == 'daily_allowance':
            # DA entered manually under 'Others' with nature='Daily Allowance'
            is_local = claim.trip.consider_as_local if (claim and claim.trip) else False
            if is_local:
                da_limit = float(getattr(rule, 'monthly_tour_daily_allowance_amount', rule.daily_allowance_amount))
            else:
                da_limit = float(rule.daily_allowance_amount)

            # Sum all DA expenses on the same date to enforce per-day cap
            exp_date = str(exp.date)[:10] if exp.date else ''
            daily_da_total = sum(
                float(e.amount)
                for e in expenses
                if (e.category or '').strip().lower() == 'others'
                and str(e.date)[:10] == exp_date
                and str(e.description or '').find('"nature": "Daily Allowance"') >= 0
            )

            # allowed_amount = full policy limit so HR can see the entitlement ceiling
            # The "exceeds" flag captures when the claim actually breaches the limit
            allowed = da_limit
            exceeds = daily_da_total > da_limit or claimed > da_limit
            if daily_da_total > da_limit:
                note = f"Daily Allowance for this date ({daily_da_total:.2f}) exceeds the policy limit of {da_limit:.2f}/day."
            elif claimed > da_limit:
                note = f"DA amount {claimed:.2f} exceeds the policy limit of {da_limit:.2f}/day."
            else:
                note = f"DA policy limit: {da_limit:.2f}/day."

        elif category == 'travel':
            mode = details.get('mode', '')
            class_type = details.get('classType', details.get('class', ''))
            
            mode_clean = str(mode).strip().lower()
            allowed_by_policy = True
            
            FLIGHT_CLASSES = ['Economy', 'Premium Economy', 'Business Class', 'First Class']
            TRAIN_CLASSES = ['Sleeper', 'Chair Car', 'III A/c', 'II A/c', 'I A/c']
            BUS_CLASSES = ['Non-AC Bus', 'AC Bus', 'Sleeper Bus', 'Volvo']
            
            def is_class_allowed(category_classes, allowed_limit_class, selected_class, mode_category):
                if not allowed_limit_class or allowed_limit_class == 'NA':
                    return True
                if not selected_class:
                    return True
                def clean(s):
                    str_val = str(s).lower().strip()
                    # ORDER MATTERS: check most-specific (III A/c = 3A) BEFORE less-specific (I A/c = 1A)
                    # to prevent 'iii a/c' from being caught by the 'i a/c' / '1a' check first.
                    if 'iii a/c' in str_val or 'iiia/c' in str_val or '3 tier' in str_val or '(3a)' in str_val or 'third' in str_val:
                        return '3a'
                    if 'ii a/c' in str_val or 'iia/c' in str_val or '2 tier' in str_val or '(2a)' in str_val or 'second' in str_val:
                        return '2a'
                    if 'first class' in str_val or '(1a)' in str_val or '1st' in str_val or 'i a/c' in str_val or 'ia/c' in str_val:
                        return '1a'
                    if 'chair' in str_val or '(cc)' in str_val or '(ec)' in str_val:
                        return 'cc'
                    if 'sleeper' in str_val or '(sl)' in str_val:
                        return 'sl'
                    if 'sitting' in str_val or '(2s)' in str_val:
                        return '2s'
                    # Flight
                    if 'premium' in str_val and 'economy' in str_val:
                        return 'premium_economy'
                    if 'economy' in str_val:
                        return 'economy'
                    if 'business' in str_val:
                        return 'business'
                    import re
                    return re.sub(r'[\/-]', '', ''.join(str_val.split()))

                sel_clean = clean(selected_class)
                limit_clean = clean(allowed_limit_class)

                # Dynamically fetch classes from Django database model
                from travel.models import TravelClassMaster
                try:
                    # Resolve category type
                    is_train = mode_category == 'train'
                    is_flight = mode_category == 'flight'
                    is_bus = mode_category == 'bus'

                    db_classes = list(TravelClassMaster.objects.filter(status=True))
                    if is_train:
                        category_list = [c for c in db_classes if c.is_train]
                    elif is_flight:
                        category_list = [c for c in db_classes if c.is_flight]
                    else:
                        category_list = [c for c in db_classes if c.is_bus]

                    category_list.sort(key=lambda x: x.id)

                    def find_best_match(s):
                        if not s:
                            return None
                        s_clean = s.strip().lower()
                        # 1. Exact match
                        for c in category_list:
                            if c.class_name.strip().lower() == s_clean:
                                return c
                        # 2. Clean match
                        c_str = clean(s)
                        for c in category_list:
                            if clean(c.class_name) == c_str:
                                return c
                        # 3. Substring match
                        for c in category_list:
                            if c_str in clean(c.class_name) or clean(c.class_name) in c_str:
                                return c
                        return None

                    sel_obj = find_best_match(selected_class)

                    # Handle comma-separated limit string
                    limit_id = -1
                    if ',' in allowed_limit_class:
                        parts = allowed_limit_class.split(',')
                        for part in parts:
                            match = find_best_match(part.strip())
                            if match and match.id > limit_id:
                                limit_id = match.id
                    else:
                        match = find_best_match(allowed_limit_class)
                        if match:
                            limit_id = match.id

                    if sel_obj and limit_id != -1:
                        return sel_obj.id <= limit_id
                except Exception as e:
                    print(f"Error checking dynamic class allowed: {e}")

                # Fallback to static lists
                TRAIN_ORDER = ['2s', 'sl', 'cc', '3a', '2a', '1a']
                FLIGHT_ORDER = ['economy', 'premium_economy', 'business', 'first_class']
                BUS_ORDER = ['non_ac', 'ac', 'sleeper', 'volvo']

                order_list = [clean(c) for c in category_classes]
                if is_train:
                    order_list = TRAIN_ORDER
                elif is_flight:
                    order_list = FLIGHT_ORDER
                elif is_bus:
                    order_list = BUS_ORDER

                try:
                    idx_limit = order_list.index(limit_clean)
                    idx_selected = order_list.index(sel_clean)
                    return idx_selected <= idx_limit
                except ValueError:
                    return True

            if 'air' in mode_clean or 'flight' in mode_clean or 'fly' in mode_clean:
                if not rule.air_allowed:
                    allowed_by_policy = False
                    note = "Travel mode Flight is not applicable for your role."
                elif not is_class_allowed(FLIGHT_CLASSES, rule.air_class, class_type, 'flight'):
                    allowed_by_policy = False
                    note = f"Flight class {class_type or 'selected'} is not applicable for your role. Allowed class: {rule.air_class}."
            elif 'train' in mode_clean or 'rail' in mode_clean:
                if not rule.train_allowed:
                    allowed_by_policy = False
                    note = "Travel mode Train is not applicable for your role."
                elif not is_class_allowed(TRAIN_CLASSES, rule.train_class, class_type, 'train'):
                    allowed_by_policy = False
                    note = f"Train class {class_type or 'selected'} is not applicable for your role. Allowed class: {rule.train_class}."
            elif 'bus' in mode_clean or 'sleeper' in mode_clean:
                if not rule.bus_allowed:
                    allowed_by_policy = False
                    note = "Travel mode Bus is not applicable for your role."
                elif not is_class_allowed(BUS_CLASSES, rule.bus_class, class_type, 'bus'):
                    allowed_by_policy = False
                    note = f"Bus class {class_type or 'selected'} is not applicable for your role. Allowed class: {rule.bus_class}."
            elif 'car' in mode_clean or 'cab' in mode_clean or 'jeep' in mode_clean or 'van' in mode_clean:
                if not rule.car_allowed:
                    allowed_by_policy = False
                    note = f"Travel mode {mode or 'Car'} is not applicable for your role."
            
            if not allowed_by_policy:
                allowed = 0.0
                exceeds = True
            else:
                allowed = claimed
                exceeds = False
                note = ""

        elif category == 'local travel' or category == 'local conveyance':
            sub_type = details.get('subType', '')
            
            def is_local_subtype_allowed(allowed_type_str, selected_subtype):
                if not allowed_type_str or allowed_type_str == 'NA':
                    return True
                if not selected_subtype:
                    return True
                allowed_clean = str(allowed_type_str).lower()
                sel_clean = str(selected_subtype).lower()

                if 'company car' in allowed_clean:
                    return sel_clean == 'company car' or sel_clean == 'pooling car'
                if '2 or 3 wheeler' in allowed_clean or '2 or 3-wheeler' in allowed_clean:
                    if 'car' in sel_clean:
                        return False
                    return True
                if 'cab' in allowed_clean or '4/3-wheeler' in allowed_clean or '4 or 3-wheeler' in allowed_clean:
                    if 'bike' in sel_clean:
                        return False
                    return True
                return True

            if not rule.local_conveyance_allowed:
                allowed = 0.0
                exceeds = True
                note = "Local Conveyance is not applicable for your role."
            elif not is_local_subtype_allowed(rule.local_conveyance_type, sub_type):
                allowed = 0.0
                exceeds = True
                note = f"Local Conveyance type {sub_type or 'selected'} is not applicable for your role. Allowed: {rule.local_conveyance_type}."
            else:
                allowed = claimed
                exceeds = False
                note = ""

        else:
            allowed = claimed
            exceeds = False
            note = ""

        expense_allowances.append({
            "expense_id": exp.id,
            "claimed_amount": claimed,
            "allowed_amount": allowed,
            "exceeds_limit": exceeds,
            "city_type": city_type_resolved,
            "policy_note": note
        })

    return {
        "cadre": matched_cadre.name if matched_cadre else "Unknown",
        "expense_allowances": expense_allowances
    }
