
$filePath = 'c:\Users\Administrator\Downloads\FinalProject\FinalProject\admin\src\Components\productManagement\productManagement.css'
$content = Get-Content $filePath

# 1. Force Product Management to allow full width
$content = $content -replace '.product-management \{', '.product-management {`n  align-items: stretch !important;'

# 2. Force all root panels to be wide
$content = $content -replace '\.acw-root, \.acw-form-container,', '.acw-root, .acw-form-container, .ast-panel, .ast-root,'
$content = $content -replace 'max-width: 1200px;', 'max-width: 1600px !important; width: 100% !important; margin-left: auto !important; margin-right: auto !important;'

# 3. Fix the price modes and reason grids to be multi-column
$content = $content -replace 'grid-template-columns: repeat\(auto-fit, minmax\(260px, 1fr\)\);', 'grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important;'

# 4. Fix batch meta grid
$content = $content -replace 'grid-template-columns: repeat\(auto-fit, minmax\(200px, 1fr\)\);', 'grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)) !important;'

# 5. Fix price adjustment list (the one in the photo)
$content = $content -replace 'grid-template-columns: repeat\(auto-fill, minmax\(320px, 1fr\)\);', 'grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)) !important;'

Set-Content $filePath $content
