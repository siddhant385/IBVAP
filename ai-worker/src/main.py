import asyncio
import json
import traceback
from typing import Dict, Any

from src.core.registry import registry
from src.core.database import get_supabase_client
from src.plugins.face_recognition.plugin import FaceRecognitionPlugin
from src.plugins.face_enrollment.plugin import FaceEnrollmentPlugin
from src.plugins.anpr.plugin import ANPRPlugin

# Register plugins
registry.register(FaceRecognitionPlugin())
registry.register(FaceEnrollmentPlugin())
registry.register(ANPRPlugin())

async def process_message(msg: Dict[str, Any]):
    message_id = msg.get('msg_id')
    payload = msg.get('message', {})
    
    # First check if the payload explicitly defines an event_type (e.g., from DB triggers)
    event_type = payload.get('event_type')
    
    # If not explicitly defined, infer it from class_id (e.g., from edge device webhook)
    if not event_type:
        class_id = payload.get('class_id')
        feature = payload.get('feature')
        
        if class_id == 0:  # person
            event_type = 'face_recognition'
        elif class_id in [2, 3, 5, 7]:  # vehicles
            event_type = 'anpr'
            
        if not event_type:
            print(f"[{message_id}] Skipping detection: not a target class (class_id={class_id})")
            return True # Return true so it gets deleted from queue
        
    plugin = registry.get_plugin(event_type)
    if plugin:
        try:
            print(f"[{message_id}] Dispatching to {event_type} plugin...")
            result = await plugin.execute(payload)
            print(f"[{message_id}] [{event_type}] Processing result: {result}")
            return True
        except Exception as e:
            print(f"[{message_id}] [{event_type}] Error during processing: {e}")
            traceback.print_exc()
            return False # Return false to keep in queue (will retry)
    else:
        print(f"[{message_id}] No plugin found for event type: {event_type}")
        return True

async def process_and_delete(msg: Dict[str, Any], queue_name: str, supabase: Any):
    message_id = msg['msg_id']
    print(f"--- Executing Task ID: {message_id} ---")
    
    success = await process_message(msg)
    
    if success:
        # Delete message from queue if successful or explicitly skipped
        try:
            await supabase.rpc('pgmq_delete', {
                'queue_name': queue_name,
                'msg_id': message_id
            }).execute()
        except Exception as e:
            print(f"[{message_id}] Failed to delete message from queue: {e}")

async def worker_loop():
    print("Starting AI Worker daemon...")
    print(f"Registered plugins: {registry.registered_events}")
    
    # Initialize supabase client once for the loop
    supabase = await get_supabase_client()
    queue_name = 'ai_processing_queue'
    
    print(f"Listening to pgmq queue: {queue_name}")
    
    while True:
        try:
            # Poll pgmq using RPC
            # read(queue_name, vt (visibility timeout in sec), qty)
            response = await supabase.rpc('pgmq_read', {
                'queue_name': queue_name,
                'vt': 30,
                'qty': 5
            }).execute()
            
            messages = response.data
            if not messages:
                await asyncio.sleep(1.0)
                continue
                
            # Process all messages concurrently
            tasks = [process_and_delete(msg, queue_name, supabase) for msg in messages]
            await asyncio.gather(*tasks)
                    
        except Exception as e:
            print(f"Error polling queue: {e}")
            await asyncio.sleep(5.0) # Backoff on error

if __name__ == "__main__":
    try:
        asyncio.run(worker_loop())
    except KeyboardInterrupt:
        print("Worker shutting down...")
