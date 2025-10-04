# Test File for Task Board Editor Extensions

This file demonstrates the new editor extensions functionality.

## Tasks with various properties

- [ ] Simple task without properties
- [ ] Task with due date 📅 2025-01-15
- [ ] Task with tags #urgent #work 
- [ ] Task with multiple properties #project 📅 2025-01-20 🔺 ⏰ 09:00-11:00
- [ ] Task with start date 🛫 2025-01-10 and due date 📅 2025-01-15
- [ ] Complete project proposal #urgent #work 📅 2025-01-15 🔺 ➕ 2025-01-01

## Testing the Extensions

### Gutter Marker Extension
- Click on the edit icon in the gutter (left margin) next to any task line
- This should open the AddOrEditTaskModal for that specific task

### Property Hiding Extension
- Task properties should be hidden in Live Editor based on the settings
- Properties are revealed when you move your cursor near them
- Works with emoji format, Tasks plugin format, and Dataview format

## Tasks Plugin Format Examples
- [ ] Task with due date [due:: 2025-01-15]
- [ ] Task with priority [priority:: 1] 
- [ ] Task with time [time:: 09:00-11:00]

## Dataview Format Examples  
- [ ] Task with due date @due(2025-01-15)
- [ ] Task with priority @priority(3)
- [ ] Task with time @time(14:00-15:30)