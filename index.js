name: eBay New Listings Tracker

on:
  schedule:
    # Runs every 5 minutes from 6 PM to midnight AEDT
    - cron: '0,5,10,15,20,25,30,35,40,45,50,55 18-23 * * *'
  workflow_dispatch:

jobs:
  check-new-listings:
    runs-on: ubuntu-latest
    # Limit total job runtime to 5 minutes
    timeout-minutes: 5
    
    steps:
    - name: Check Time Window
      # Check if current time is between 6 PM and midnight AEDT
      run: |
        current_hour=$(TZ='Australia/Sydney' date +%H)
        if [ $current_hour -lt 18 ] || [ $current_hour -ge 24 ]; then
          echo "Outside of target time window (6 PM to midnight AEDT)"
          exit 78  # Neutral exit code to skip the job
        fi
    
    - name: Checkout repository
      uses: actions/checkout@v4
    
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: |
        npm install axios @octokit/rest
    
    - name: Check eBay Listings
      id: ebay-check
      env:
        EBAY_API_KEY: ${{ secrets.EBAY_API_KEY }}
        SELLER_USERNAME: ${{ secrets.SELLER_USERNAME }}
        PROCESSED_LISTING_IDS: ${{ secrets.PROCESSED_LISTING_IDS }}
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      run: |
        node index.js
      continue-on-error: true
      
    - name: Read Listing Results
      id: read-results
      if: ${{ steps.ebay-check.outcome == 'success' }}
      run: |
        result=$(cat ebay-tracker/listing_results.json)
        echo "result=${result}" >> $GITHUB_OUTPUT

    - name: Send Mail
      # Only send email if previous step found new listings
      if: ${{ steps.read-results.outputs.result != '' }}
      uses: dawidd6/action-send-mail@v4
      with:
        server_address: smtp.gmail.com
        server_port: 465
        secure: true
        username: ${{secrets.MAIL_USERNAME}}
        password: ${{secrets.MAIL_PASSWORD}}
        subject: New eBay Listings Found
        to: ${{secrets.NOTIFICATION_EMAIL}}
        from: GitHub Actions <${{secrets.MAIL_USERNAME}}>
        body: |
          New eBay Listings Detected:

          ${{ fromJson(steps.read-results.outputs.result).listingDetails }}
        
        # Optional priority
        priority: high

# Optimization to reduce GitHub Actions resources
env:
  # Reduce verbosity of npm logs
  NODE_OPTIONS: '--no-warnings'
  # Disable colored output to reduce log size
  NO_COLOR: '1'