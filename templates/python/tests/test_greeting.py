from {{module}} import greeting


def test_greeting_names_the_caller() -> None:
    assert greeting("Ada") == "Hello, Ada, from {{name}}."
