import requests
import time

if __name__ == "__main__":
    # Initial API call

    # Assume this is an incoming API call as a JSON object
    call = {
        "user_input": "",
        "messages": [],
        "metadata": {}
    }

    # What the frontend should be holding
    url = "http://127.0.0.1:8000/call_model"
    frontend_memory = requests.post(url, json=call).json()

    while(True):
        # Loop and display from frontend memory
        latest_user, latest_message = frontend_memory["messages"][-1]
        print(f"[{latest_user}]: ", end="")

        for char in latest_message:
            print(char, end="", flush=True)
            time.sleep(0.005)

        print("\n")
        # Frontend user input
        user_input = input("\033[44m[user]: ")
        print("\033[0m")

        # Emulated API Call
        call["user_input"] = user_input
        call["messages"] = frontend_memory["messages"]
        call["metadata"] = frontend_memory["recent_metadata"]

        frontend_memory = requests.post(url, json=call).json()