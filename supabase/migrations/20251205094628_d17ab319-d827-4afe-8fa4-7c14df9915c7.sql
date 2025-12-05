-- Reset R2 objects to pending since files don't actually exist
UPDATE r2_storage_objects 
SET status = 'pending', 
    error_message = NULL
WHERE error_message = 'Reset - file needs to be downloaded';