$path = 'mobile\lib\screens\trip_expense_form_detailed.dart'
$c = Get-Content $path
$c[1214] = '        ),'
$c[1564] = '        ),'
$c[1671] = '        ),'
$c[2985] = '                            ),'
$c[3857] = '        ),'
$c | Set-Content $path
