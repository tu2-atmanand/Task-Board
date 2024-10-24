import os
import re
import requests
from deep_translator import GoogleTranslator
from deep_translator.exceptions import LanguageNotSupportedException

class DummyTranslator:
    def translate(self, text):
        return text

# Set up the translator using deep_translator
def get_translator(lang_code):
    try:
        return GoogleTranslator(source='en', target=lang_code)
    except LanguageNotSupportedException:
        return DummyTranslator()


# Path to the lang folder
lang_folder = "D:\\Personal_Projects_Hub\\IDE_Wise_Projects\\Obsidian\\TemplateToDevelopPlugin\\.obsidian\\plugins\\task-board\\src\\utils\\lang\\locale"

# Function to load the en.ts file and extract keys and values
def load_en_file():
    en_file = os.path.join(lang_folder, 'en.ts')
    with open(en_file, 'r', encoding='utf-8') as file:
        en_data = file.read()
    # Parse the en.ts file to extract keys and values
    matches = re.findall(r'(\d+):\s*"(.+?)"', en_data)
    return {int(k): v for k, v in matches}

# Function to update other language files with translations
def update_lang_file(lang_code, keys, en_dict):
    lang_file = os.path.join(lang_folder, f'{lang_code}.ts')
    with open(lang_file, 'r', encoding='utf-8') as file:
        lang_data = file.read()

    # Parse the language file into a dictionary
    lang_dict = {}
    matches = re.findall(r'(\d+):\s*"(.+?)"', lang_data)
    for key, value in matches:
        lang_dict[int(key)] = value

    # Update the dictionary with new translations
    translator = get_translator(lang_code)
    for key in keys:
        original_text = en_dict[key]
        translated_text = translate_or_prompt(lang_code, original_text, translator)
        print(f"\nOriginal Text : {original_text} \nTranslated Text : {translated_text}\n")
        lang_dict[key] = translated_text

    # Write updated language file
    with open(lang_file, 'w', encoding='utf-8') as file:
        file.write('const {} = {{\n'.format(lang_code))
        for key, value in lang_dict.items():
            file.write(f'  {key}: "{value}",\n')
        file.write('};\n')
        file.write(f"export default {lang_code};")


# Function to translate text using Google Translate or ask user for manual input
def translate_or_prompt(lang_code, text, translator):
    try:
        # Use deep_translator to translate
        translated = translator.translate(text)
        return translated
    except Exception:
        print(f"Could not auto-translate '{text}' to {lang_code}.")
        return input(f"Please enter the translation for '{text}' in {lang_code}: ")

# Main script function
def main():
    # Load English key-value pairs
    en_dict = load_en_file()
    # Get keys from the user
    keys_input = input("Enter the keys that have been changed (e.g., 45 47 77): ")
    if keys_input.strip() == '0':
        keys = list(en_dict.keys())
    else:
        keys = [int(k.strip()) for k in re.split(r'[,\s]+', keys_input.strip())]
    # Iterate through language files and update them
    for lang_file in os.listdir(lang_folder):
        if lang_file.endswith('.ts') and lang_file != 'en.ts':
            lang_code = lang_file.replace('.ts', '')
            print(f"\n-------------------- Updating the following file : {lang_code}.ts ... --------------\n")
            update_lang_file(lang_code, keys, en_dict)

if __name__ == '__main__':
    main()
