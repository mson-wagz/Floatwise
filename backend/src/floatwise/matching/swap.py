# Mock-up implementation for a hackathon project

def swap_items(item_list, index1, index2):
    """Swap two items in a list given their indices."""
    if index1 < 0 or index1 >= len(item_list) or index2 < 0 or index2 >= len(item_list):
        raise IndexError("Index out of range")
    item_list[index1], item_list[index2] = item_list[index2], item_list[index1]

def main():
    # Example usage of the swap function
    items = ['apple', 'banana', 'cherry', 'date']
    print("Before swap:", items)
    swap_items(items, 1, 3)
    print("After swap:", items)

if __name__ == "__main__":
    main()