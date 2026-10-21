-- Anki decks imported from .apkg/.colpkg files are a source of their own.
alter table sources drop constraint sources_type_check;
alter table sources add constraint sources_type_check check(type in ('google_sheet','google_doc','pdf_upload','preply_chat','manual','class_recording','anki_deck'));
